import { X } from "@phosphor-icons/react"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"

import { UsageGuide } from "./usage-guide"

export type GuideTab = "usage" | "shooting"

type GuideDialogProps = {
  readonly initialTab?: GuideTab
  readonly onClose: () => void
  readonly open: boolean
}

const GUIDE_TABS: readonly { readonly id: GuideTab; readonly label: string }[] = [
  { id: "usage", label: "사용 안내" },
  { id: "shooting", label: "촬영 가이드" },
]

export const GUIDE_SEQUENCE = [
  "1 정면 — 카메라를 정면으로 응시",
  "2 우측 45도 — 코가 화면 오른쪽을 향하게",
  "3 좌측 45도 — 코가 화면 왼쪽을 향하게",
  "4 우측 측면 — 90도, 반대쪽 눈썹이 보이지 않게",
  "5 좌측 측면 — 90도, 반대쪽 눈썹이 보이지 않게",
  "6 아래 (턱 밑) — 고개를 들어 턱 밑이 보이게",
  "7 위 (정수리) — 고개를 숙여 정수리가 보이게",
] as const

// 가이드 대화상자(2026-09-03 bee 지적: 설정 안에 묻히면 아무도 못 찾는다) — 상단 명령 막대의
// '가이드' 버튼에서 바로 연다. 같은 날 확장: 참가자에게 안내 링크를 따로 보내지 않도록
// '사용 안내' 탭을 앞에 두고 '촬영 가이드'는 둘째 탭으로 둡니다.
export function GuideDialog({
  initialTab = "usage",
  onClose,
  open,
}: GuideDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<GuideTab>(initialTab)

  useEffect(() => {
    if (open) {
      setTab(initialTab)
    }
  }, [open, initialTab])

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

  // 탭은 좌우 화살표로도 옮긴다(모든 기능 키보드 조작 원칙).
  const handleTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return
    }
    event.preventDefault()
    const index = GUIDE_TABS.findIndex((item) => item.id === tab)
    const nextIndex =
      (index + (event.key === "ArrowRight" ? 1 : GUIDE_TABS.length - 1)) % GUIDE_TABS.length
    const next = GUIDE_TABS[nextIndex]
    if (next === undefined) {
      return
    }
    setTab(next.id)
    document.getElementById(`guide-tab-${next.id}`)?.focus()
  }

  return (
    <dialog
      aria-labelledby="guide-title"
      className="help-surface help-surface--guide"
      ref={dialogRef}
    >
      <header className="help-surface__header">
        <h2 id="guide-title">가이드</h2>
        <button aria-label="가이드 닫기" onClick={closeDialog} type="button">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: 화살표 키 처리는 tablist 관용 패턴이며 탭 버튼 자체가 상호작용 요소다. */}
      <div aria-label="가이드 종류" className="guide-tabs" onKeyDown={handleTabKey} role="tablist">
        {GUIDE_TABS.map((item) => (
          <button
            aria-controls={`guide-panel-${item.id}`}
            aria-selected={tab === item.id}
            className="guide-tabs__tab"
            id={`guide-tab-${item.id}`}
            key={item.id}
            onClick={() => setTab(item.id)}
            role="tab"
            tabIndex={tab === item.id ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "usage" ? (
        <div
          aria-labelledby="guide-tab-usage"
          className="guide-tabs__panel"
          id="guide-panel-usage"
          role="tabpanel"
        >
          <UsageGuide />
        </div>
      ) : (
        <div
          aria-labelledby="guide-tab-shooting"
          className="guide-tabs__panel"
          id="guide-panel-shooting"
          role="tabpanel"
        >
          <section aria-labelledby="guide-setup-title" className="help-surface__section">
            <h3 id="guide-setup-title">촬영 조건 (전문의 검토 전 초안)</h3>
            <p>
              단색 배경, 고른 조명, 환자 눈높이에 고정한 카메라로 한 환자의 7장을 중간에 끊지 말고
              이어서 촬영하세요. 좌우 표기는 전부 환자 기준입니다.
            </p>
          </section>

          <section aria-labelledby="guide-sequence-title" className="help-surface__section">
            <h3 id="guide-sequence-title">촬영 순서</h3>
            <ol className="help-surface__sequence">
              {GUIDE_SEQUENCE.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="guide-file-title" className="help-surface__section">
            <h3 id="guide-file-title">파일과 확인</h3>
            <p>
              카메라는 JPEG로 저장하세요(RAW 단독 저장은 열 수 없습니다). 자동 판정은 보조
              기능이므로 내보내기 전에 좌우 방향과 크롭을 직접 확인하세요.
            </p>
          </section>
        </div>
      )}
    </dialog>
  )
}
