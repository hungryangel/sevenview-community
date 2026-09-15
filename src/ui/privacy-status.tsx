import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"

import type { Activity } from "../product/activity-status"

export type PrivacyState = "localReady" | "modelLoading" | "modelError"

type PrivacyStatusProps = {
  // 지금 벌어지는 일(2026-09-02 bee 요청). 없으면 모델 상태 문구만 보인다.
  readonly activity?: Activity | undefined
  readonly state: PrivacyState
}

type StatusContent = {
  readonly icon: ReactNode
  readonly label: string
  readonly detail: string
}

const STATUS_CONTENT = {
  localReady: {
    icon: <span aria-hidden="true" className="privacy-status__dot" />,
    label: "로컬 처리",
    detail: "사진 바이트는 이 브라우저 밖으로 전송되지 않습니다.",
  },
  modelLoading: {
    icon: <SpinnerGap aria-hidden="true" className="privacy-status__spinner" size={17} />,
    label: "로컬 모델 준비 중",
    detail: "번들에 포함된 얼굴 랜드마크 모델을 이 브라우저에서 시작하고 있습니다.",
  },
  modelError: {
    icon: <WarningCircle aria-hidden="true" size={17} weight="fill" />,
    label: "로컬 모델 준비 실패",
    detail: "브라우저가 포함된 얼굴 랜드마크 모델을 시작하지 못했습니다.",
  },
} as const satisfies Record<PrivacyState, StatusContent>

const ACTIVITY_ICON: Record<Activity["kind"], ReactNode> = {
  idle: <span aria-hidden="true" className="privacy-status__dot" />,
  busy: <SpinnerGap aria-hidden="true" className="privacy-status__spinner" size={17} />,
  done: <CheckCircle aria-hidden="true" size={17} weight="fill" />,
  error: <WarningCircle aria-hidden="true" size={17} weight="fill" />,
}

const CROSSFADE_MILLISECONDS = 120

function contentFor(state: PrivacyState, activity: Activity | undefined): StatusContent {
  const base = STATUS_CONTENT[state]
  if (activity === undefined) {
    return base
  }
  // 사진이 밖으로 나가지 않는다는 약속은 어떤 상태에서도 보조 설명으로 남는다.
  return { icon: ACTIVITY_ICON[activity.kind], label: activity.label, detail: base.detail }
}

function StatusVisual({
  content,
  detailId,
  phase,
}: {
  readonly content: StatusContent
  readonly detailId?: string
  readonly phase: "incoming" | "outgoing"
}) {
  return (
    <span
      aria-hidden={phase === "outgoing" ? true : undefined}
      className={`privacy-status__content privacy-status__content--${phase}`}
    >
      {content.icon}
      <span>{content.label}</span>
      {detailId === undefined ? null : (
        <span className="sr-only" id={detailId}>
          {content.detail}
        </span>
      )}
    </span>
  )
}

export function PrivacyStatus({ activity, state }: PrivacyStatusProps) {
  const content = contentFor(state, activity)
  const detailId = useId()
  const currentContent = useRef(content)
  currentContent.current = content
  const previousContent = useRef(content)
  const [outgoingContent, setOutgoingContent] = useState<StatusContent | null>(null)

  // 문구가 바뀔 때만 크로스페이드를 시작한다. 의존성을 문구(문자열)로 두는 이유:
  // content 객체는 렌더마다 새로 만들어져, 객체를 의존성으로 두면 매 렌더 정리 함수가
  // 타이머를 취소해 나가는 문구가 영영 남는다(2026-09-02 E2E 스냅샷에서 발견).
  const label = content.label
  useEffect(() => {
    if (previousContent.current.label === label) {
      return undefined
    }

    setOutgoingContent(previousContent.current)
    previousContent.current = currentContent.current
    const timer = window.setTimeout(() => setOutgoingContent(null), CROSSFADE_MILLISECONDS)
    return () => window.clearTimeout(timer)
  }, [label])

  const tone = activity?.kind ?? "idle"

  return (
    <span
      aria-describedby={detailId}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`privacy-status privacy-status--${state} privacy-status--${tone}`}
      role="status"
    >
      <span className="privacy-status__stage">
        {outgoingContent === null ? null : (
          <StatusVisual content={outgoingContent} phase="outgoing" />
        )}
        <StatusVisual content={content} detailId={detailId} key={content.label} phase="incoming" />
      </span>
    </span>
  )
}
