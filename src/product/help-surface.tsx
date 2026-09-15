import { X } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

import { STANDARD_SEVEN_VIEW_DRAFT } from "../domain/protocol-preset"
import { Button } from "../ui/button"
import { APP_VERSION } from "./app-footer"
import { GUIDE_COLORS, type GuideColorId } from "./guide-color"
import { GUIDE_WIDTHS, type GuideWidthId } from "./guide-width"

export { KAKAO_CHAT_URL } from "./app-footer"

type HelpSurfaceProps = {
  readonly exportCount: number
  readonly guideColor: GuideColorId
  readonly guideWidth: GuideWidthId
  readonly onChangeGuideColor: (color: GuideColorId) => void
  readonly onChangeGuideWidth: (width: GuideWidthId) => void
  readonly onClose: () => void
  readonly open: boolean
  readonly reviewCount: number
  readonly sessionStartedAt: number
}

export const ROADMAP_ITEMS = [
  "SD카드를 꽂으면 자동으로 가져오기",
  "작업 저장하고 다시 열기",
  "병원별 촬영 프리셋",
  "RAW 파일 직접 지원",
  "차트 프로그램 연동",
] as const

// 2026-09-02 bee 결정: 푸터의 '도움말 · 준비 중인 기능'을 '설정 · 정보'로 바꾼다.
// 2026-09-03: 뷰 세트·프레이밍은 검토 화면 도구막대로, 촬영 가이드는 상단 '가이드' 버튼으로
// 옮겼다. 여기에는 브라우저 설정(기준선 색)·위치 안내·버전·준비 중인 기능·세션 요약만 남는다.
export function HelpSurface({
  exportCount,
  guideColor,
  guideWidth,
  onChangeGuideColor,
  onChangeGuideWidth,
  onClose,
  open,
  reviewCount,
  sessionStartedAt,
}: HelpSurfaceProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const dialogRef = useRef<HTMLDialogElement>(null)

  // native <dialog>가 Esc 닫기·포커스 이동·포커스 복귀를 맡는다.
  // jsdom은 showModal 미구현이라 open 속성으로 대신 연다(단위 테스트 경로).
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const dialog = dialogRef.current
    if (dialog === null) {
      return undefined
    }
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal()
      } else {
        dialog.setAttribute("open", "")
      }
    }
    const handleClose = () => onClose()
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const closeDialog = () => {
    const dialog = dialogRef.current
    if (dialog !== null && typeof dialog.close === "function" && dialog.open) {
      dialog.close()
      return
    }
    onClose()
  }

  const copySummary = async () => {
    const elapsedMinutes = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60_000))
    const summary = `SevenView 세션 요약 · 내보내기 ${exportCount}세트 · 검토 경고 ${reviewCount}건 · 경과 ${elapsedMinutes}분 · v${APP_VERSION}`
    try {
      await navigator.clipboard.writeText(summary)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  return (
    <dialog aria-labelledby="help-title" className="help-surface" ref={dialogRef}>
      <header className="help-surface__header">
        <h2 id="help-title">설정 · 정보</h2>
        <button aria-label="설정 닫기" onClick={closeDialog} type="button">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <section aria-labelledby="help-settings-title" className="help-surface__section">
        <h3 id="help-settings-title">설정</h3>
        <fieldset className="guide-color-options">
          <legend>기준선 색</legend>
          {GUIDE_COLORS.map((option) => (
            <label className="guide-color-option" key={option.id}>
              <input
                aria-label={`기준선 색 ${option.label}`}
                checked={option.id === guideColor}
                name="guide-color"
                onChange={() => onChangeGuideColor(option.id)}
                type="radio"
                value={option.id}
              />
              <span
                aria-hidden="true"
                className="guide-color-option__swatch"
                style={{ background: option.value }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="guide-color-options">
          <legend>기준선 두께</legend>
          {GUIDE_WIDTHS.map((option) => (
            <label className="guide-color-option" key={option.id}>
              <input
                aria-label={`기준선 두께 ${option.label}`}
                checked={option.id === guideWidth}
                name="guide-width"
                onChange={() => onChangeGuideWidth(option.id)}
                type="radio"
                value={option.id}
              />
              <span
                aria-hidden="true"
                className="guide-width-option__sample"
                style={{ blockSize: option.px }}
              />
              {option.label} ({option.px}px)
            </label>
          ))}
        </fieldset>
        <p className="guide-color-preview">
          중심선·눈높이 기준선에만 적용되는 화면 표시입니다. 내보내는 이미지에는 그려지지 않습니다.
        </p>
        <p>
          프로토콜: {STANDARD_SEVEN_VIEW_DRAFT.name} · 좌우 표기는 환자 기준입니다. 뷰 세트와 크롭
          프레이밍은 검토 화면 상단의 '뷰 세트'·'프레이밍' 버튼에서, 촬영 가이드는 맨 위 '가이드'
          버튼에서 바로 봅니다. 설정은 이 브라우저 안에서만 유지됩니다.
        </p>
      </section>

      <section aria-labelledby="help-about-title" className="help-surface__section">
        <h3 id="help-about-title">정보</h3>
        <p>SevenView v{APP_VERSION} · 사진은 이 브라우저 밖으로 나가지 않습니다.</p>
        <h4>준비 중인 기능</h4>
        <p>병원 연동판에서 준비하고 있어요.</p>
        <ul className="help-surface__roadmap">
          {ROADMAP_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>먼저 필요한 기능이 있으면 푸터의 '신고 · 기능 문의'로 알려주세요.</p>
      </section>

      <section aria-labelledby="help-summary-title" className="help-surface__section">
        <h3 id="help-summary-title">이번 세션 요약</h3>
        <p>
          내보내기 횟수, 경고 수, 경과 시간만 담은 한 줄을 복사합니다. 사진·파일명·환자 정보는
          포함되지 않습니다.
        </p>
        <div className="help-surface__summary-actions">
          <Button onClick={() => void copySummary()} variant="quiet">
            이번 세션 요약 복사
          </Button>
          <span aria-live="polite">
            {copyState === "copied"
              ? "복사했습니다. 푸터의 '신고 · 기능 문의'에 붙여넣어 보내주세요."
              : copyState === "failed"
                ? "복사하지 못했습니다. 브라우저 권한을 확인해 주세요."
                : ""}
          </span>
        </div>
      </section>
    </dialog>
  )
}
