import { CaretDown } from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import type { FramingPreset, FramingPresetId } from "../domain/protocol-preset"
import type { ViewSet, ViewSetId } from "../domain/view-set"
import type { WorkspacePhoto, WorkspaceSourcePhoto } from "../domain/workspace"
import { Button } from "../ui/button"
import type { DismissReason } from "../ui/use-dismissable"
import { FramingCards, ViewSetCards } from "./protocol-cards"

type Picker = "framing" | "viewSet"

const POPOVER_WIDTH_PX = 448
const POPOVER_MARGIN_PX = 16
const POPOVER_GAP_PX = 8

type ProtocolToolbarProps = {
  readonly framing: FramingPreset
  readonly onChangeFramingPreset: (preset: FramingPresetId) => void
  readonly onChangeViewSet: (viewSet: ViewSetId) => void
  readonly photos: readonly WorkspacePhoto<CanvasImageSource>[]
  readonly previewPhoto: WorkspacePhoto<CanvasImageSource> | null
  readonly spares: readonly WorkspaceSourcePhoto<CanvasImageSource>[]
  readonly viewSet: ViewSet
}

// 검토 화면 상단 도구막대(2026-09-03 bee 지적: "프리셋·크롭은 설정이 아니라 사용 화면에서").
// 두 칩이 현재 값을 항상 보여주고, 누르면 그 자리에서 카드 팝오버가 열린다. 고르는 즉시
// 뒤의 레일·그리드가 바뀌므로 변화가 보인다. 키보드: Enter로 열기 → 선택된 카드에 포커스 →
// 화살표로 고르기 → Esc로 닫으면 칩으로 포커스 복귀.
export function ProtocolToolbar({
  framing,
  onChangeFramingPreset,
  onChangeViewSet,
  photos,
  previewPhoto,
  spares,
  viewSet,
}: ProtocolToolbarProps) {
  const [open, setOpen] = useState<Picker | null>(null)
  // 팝오버는 화면 기준(fixed)으로 띄운다: 가운데 열이 스크롤 컨테이너라 absolute면 열 아래로
  // 잘린다. 여는 순간 칩의 위치를 재서 그 아래에 놓고, 화면 안에 들어오게 좌우·높이를 맞춘다.
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  const openRef = useRef<Picker | null>(null)
  openRef.current = open
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const viewSetChipRef = useRef<HTMLButtonElement>(null)
  const framingChipRef = useRef<HTMLButtonElement>(null)

  // 바깥 클릭으로 닫힐 땐 포커스를 건드리지 않는다(사용자가 다른 곳을 눌렀으므로).
  const close = useCallback((reason: DismissReason | "button" | "scroll") => {
    const current = openRef.current
    setOpen(null)
    if (current !== null && reason !== "pointer" && reason !== "scroll") {
      const chip = current === "viewSet" ? viewSetChipRef.current : framingChipRef.current
      chip?.focus()
    }
  }, [])

  // 팝오버는 body에 포털로 띄운다(아래 JSX). 가운데 열(스크롤 컨테이너) 안에 두면 라디오에
  // 포커스/scrollIntoView가 갈 때 열이 스크롤돼 칩이 밀려나고 팝오버가 닫혔다(2026-09-03 E2E).
  // 그래서 useDismissable 대신 칩 컨테이너와 팝오버 둘 다를 "안쪽"으로 보는 닫기 규칙을 둔다.
  useEffect(() => {
    if (open === null) {
      return undefined
    }
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (containerRef.current?.contains(target) === true ||
        popoverRef.current?.contains(target) === true)
    const handlePointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) {
        close("pointer")
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close("escape")
      }
    }
    // Tab으로 포커스가 칩·팝오버 밖으로 나가면 메뉴처럼 닫힌다(포커스는 건드리지 않는다).
    // 포털 밖 요소라 React onBlur 대신 문서 수준 focusin으로 본다.
    const handleFocusIn = (event: FocusEvent) => {
      if (!inside(event.target)) {
        close("pointer")
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("focusin", handleFocusIn)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("focusin", handleFocusIn)
    }
  }, [open, close])

  // 열리면 선택된 카드(체크된 라디오)로 포커스를 옮긴다 — 화살표 키가 바로 먹는다.
  useEffect(() => {
    if (open === null) {
      return
    }
    popoverRef.current?.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus()
  }, [open])

  // 칩 바로 아래 자리. 칩이 가운데 열 밖으로 스크롤돼 안 보이면 null(= 닫아야 함).
  const anchorFor = useCallback((picker: Picker): { left: number; top: number } | null => {
    const chip = picker === "viewSet" ? viewSetChipRef.current : framingChipRef.current
    if (chip === null) {
      return null
    }
    const rect = chip.getBoundingClientRect()
    const clip = chip.closest(".workspace-shell__center")?.getBoundingClientRect()
    if (clip !== undefined && (rect.bottom < clip.top || rect.top > clip.bottom)) {
      return null
    }
    const width = Math.min(POPOVER_WIDTH_PX, window.innerWidth - 2 * POPOVER_MARGIN_PX)
    return {
      left: Math.max(
        POPOVER_MARGIN_PX,
        Math.min(rect.left, window.innerWidth - width - POPOVER_MARGIN_PX),
      ),
      top: rect.bottom + POPOVER_GAP_PX,
    }
  }, [])

  // 스크롤·리사이즈로 칩이 움직이면 fixed 팝오버를 따라 옮긴다(팝오버 자체 스크롤은 제외).
  // 닫지 않고 따라가는 이유: 프로그램적 스크롤 직후의 클릭(예: 자동화의 scrollIntoView→click)은
  // 열린 뒤에 scroll 이벤트가 도착해 방금 연 팝오버를 닫아버린다(2026-09-03 E2E 재현).
  useEffect(() => {
    if (open === null) {
      return undefined
    }
    let frame = 0
    const reposition = (event?: Event) => {
      if (event?.target instanceof Node && popoverRef.current?.contains(event.target)) {
        return
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = anchorFor(open)
        if (next === null) {
          close("scroll")
        } else {
          setAnchor(next)
        }
      })
    }
    document.addEventListener("scroll", reposition, true)
    window.addEventListener("resize", reposition)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("scroll", reposition, true)
      window.removeEventListener("resize", reposition)
    }
  }, [open, close, anchorFor])

  const toggle = (picker: Picker) => {
    if (openRef.current === picker) {
      setOpen(null)
      return
    }
    const next = anchorFor(picker)
    if (next === null) {
      return
    }
    setAnchor(next)
    setOpen(picker)
  }

  return (
    <div className="protocol-toolbar" ref={containerRef}>
      <button
        aria-expanded={open === "viewSet"}
        aria-haspopup="dialog"
        className={`protocol-chip${open === "viewSet" ? " protocol-chip--open" : ""}`}
        onClick={() => toggle("viewSet")}
        ref={viewSetChipRef}
        type="button"
      >
        <span className="protocol-chip__label">뷰 세트</span>
        <strong className="protocol-chip__value">{viewSet.shortLabel}</strong>
        <CaretDown aria-hidden="true" size={12} />
      </button>
      <button
        aria-expanded={open === "framing"}
        aria-haspopup="dialog"
        className={`protocol-chip${open === "framing" ? " protocol-chip--open" : ""}`}
        onClick={() => toggle("framing")}
        ref={framingChipRef}
        type="button"
      >
        <span className="protocol-chip__label">프레이밍</span>
        <strong className="protocol-chip__value">{framing.shortLabel}</strong>
        <CaretDown aria-hidden="true" size={12} />
      </button>

      {open === null || anchor === null
        ? null
        : createPortal(
            <div
              aria-label={open === "viewSet" ? "뷰 세트 선택" : "크롭 프레이밍 선택"}
              className="protocol-popover"
              ref={popoverRef}
              role="dialog"
              style={{
                insetBlockStart: anchor.top,
                insetInlineStart: anchor.left,
                maxBlockSize: `calc(100dvh - ${anchor.top + POPOVER_MARGIN_PX}px)`,
              }}
            >
              {open === "viewSet" ? (
                <ViewSetCards
                  onChangeViewSet={onChangeViewSet}
                  photos={photos}
                  spares={spares}
                  viewSet={viewSet}
                />
              ) : (
                <FramingCards
                  framing={framing}
                  onChangeFramingPreset={onChangeFramingPreset}
                  previewPhoto={previewPhoto}
                />
              )}
              <div className="protocol-popover__footer">
                <small>고르면 바로 적용됩니다. Esc 또는 바깥을 눌러 닫습니다.</small>
                <Button onClick={() => close("button")} variant="quiet">
                  닫기
                </Button>
              </div>
            </div>,
            document.body,
          )}
    </div>
  )
}
