import { SlidersHorizontal } from "@phosphor-icons/react"
import { useCallback, useRef, useState } from "react"
import { Button } from "../ui/button"
import { type DismissReason, useDismissable } from "../ui/use-dismissable"
import type { ContactSheetGridProps } from "./contact-sheet-grid"

type Props = Pick<
  ContactSheetGridProps,
  | "headingId"
  | "toolbar"
  | "inspectorOpen"
  | "onOpenInspector"
  | "onStartReview"
  | "onResetSelectedAdjustment"
  | "selectedPhotoAdjusted"
  | "selectedViewLabel"
  | "onSetReviewAlignment"
  | "onSetReviewDisplayMode"
  | "onSetReviewZoom"
  | "reviewAlignment"
  | "reviewDisplayMode"
  | "reviewZoom"
  | "views"
>
export function ContactSheetHeader({
  headingId = "review-title",
  toolbar,
  inspectorOpen,
  onOpenInspector,
  onStartReview,
  onResetSelectedAdjustment,
  selectedPhotoAdjusted,
  selectedViewLabel,
  onSetReviewAlignment,
  onSetReviewDisplayMode,
  onSetReviewZoom,
  reviewAlignment,
  reviewDisplayMode,
  reviewZoom,
  views,
}: Props) {
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false)
  const viewOptionsTriggerRef = useRef<HTMLButtonElement>(null)
  const closeViewOptions = () => {
    setViewOptionsOpen(false)
    viewOptionsTriggerRef.current?.focus()
  }
  // 2026-09-02 bee 지적: 원본으로 보다가 'AI 정렬'을 누르면 수동 보정이 그대로 남는다 —
  // 보정된 뷰라면 "AI 정렬을 다시 반영할지" 물어야 한다(막지 않고 선택지를 준다).
  const [confirmingAlignment, setConfirmingAlignment] = useState(false)
  const alignmentRef = useRef<HTMLDivElement>(null)
  const dismissAlignmentConfirm = useCallback((_reason: DismissReason) => {
    setConfirmingAlignment(false)
  }, [])
  useDismissable(confirmingAlignment, dismissAlignmentConfirm, alignmentRef)
  const handleAlignedClick = () => {
    if (reviewAlignment === "aligned") {
      return
    }
    if (selectedPhotoAdjusted) {
      setConfirmingAlignment((open) => !open)
      return
    }
    onSetReviewAlignment("aligned")
  }

  return (
    <header className="review-canvas__header">
      <div className="review-canvas__title">
        <h1 id={headingId} tabIndex={-1}>
          임상 사진 검토
        </h1>
        {toolbar}
      </div>
      <div className="review-canvas__actions">
        {onStartReview === null ? null : (
          <Button onClick={onStartReview} variant="secondary">
            검토 시작
          </Button>
        )}
        <Button
          aria-controls="workspace-inspector"
          aria-expanded={inspectorOpen}
          onClick={onOpenInspector}
          variant="secondary"
        >
          <SlidersHorizontal aria-hidden="true" size={18} /> 세부 조정
        </Button>
        <div className="review-canvas__options">
          <Button
            aria-controls="review-view-options"
            aria-expanded={viewOptionsOpen}
            onClick={() => setViewOptionsOpen((open) => !open)}
            ref={viewOptionsTriggerRef}
            variant="secondary"
          >
            보기 옵션
          </Button>
          {viewOptionsOpen ? (
            <fieldset
              className="review-canvas__options-panel"
              id="review-view-options"
              onKeyDown={(event) => {
                if (event.key !== "Escape") {
                  return
                }
                const nestedDialog =
                  event.target instanceof Element ? event.target.closest('[role="dialog"]') : null
                if (nestedDialog !== null && event.currentTarget.contains(nestedDialog)) {
                  return
                }
                event.preventDefault()
                event.stopPropagation()
                closeViewOptions()
              }}
            >
              <legend className="sr-only">보기 옵션</legend>
              <div className="review-canvas__alignment" ref={alignmentRef}>
                <div className="review-canvas__view-switch">
                  <Button
                    aria-pressed={reviewAlignment === "original"}
                    onClick={() => {
                      setConfirmingAlignment(false)
                      onSetReviewAlignment("original")
                    }}
                    variant="quiet"
                  >
                    원본
                  </Button>
                  <Button
                    aria-expanded={selectedPhotoAdjusted ? confirmingAlignment : undefined}
                    aria-pressed={reviewAlignment === "aligned"}
                    onClick={handleAlignedClick}
                    variant="quiet"
                  >
                    AI 정렬
                  </Button>
                </div>
                {confirmingAlignment ? (
                  <div
                    aria-label="AI 정렬 반영 확인"
                    className="review-canvas__confirm"
                    role="dialog"
                  >
                    <strong>'{selectedViewLabel}'은 수동으로 보정된 뷰입니다</strong>
                    <p>AI 정렬 결과를 다시 반영하면 이 뷰의 위치·회전·배율 보정이 초기화됩니다.</p>
                    <div>
                      <Button
                        onClick={() => {
                          setConfirmingAlignment(false)
                          onSetReviewAlignment("aligned")
                        }}
                        variant="quiet"
                      >
                        보정 유지
                      </Button>
                      <Button
                        onClick={() => {
                          setConfirmingAlignment(false)
                          onResetSelectedAdjustment()
                          onSetReviewAlignment("aligned")
                        }}
                        variant="destructive"
                      >
                        AI 정렬로 재설정
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="review-canvas__view-switch">
                <Button
                  aria-pressed={reviewDisplayMode === "grid"}
                  onClick={() => onSetReviewDisplayMode("grid")}
                  variant="quiet"
                >
                  {views.length}장 보기
                </Button>
                <Button
                  aria-pressed={reviewDisplayMode === "single"}
                  onClick={() => onSetReviewDisplayMode("single")}
                  variant="quiet"
                >
                  단일 뷰 확대
                </Button>
              </div>
              <div className="review-canvas__zoom">
                <span className="review-canvas__zoom-label">화면 확대</span>
                <Button
                  aria-label="미리보기 축소"
                  disabled={reviewZoom <= 0.85}
                  onClick={() => onSetReviewZoom(Math.max(0.85, reviewZoom - 0.15))}
                  variant="quiet"
                >
                  −
                </Button>
                <Button
                  aria-label="미리보기 맞춤"
                  onClick={() => onSetReviewZoom(1)}
                  variant="quiet"
                >
                  맞춤
                </Button>
                <Button
                  aria-label="미리보기 확대"
                  disabled={reviewZoom >= 1.15}
                  onClick={() => onSetReviewZoom(Math.min(1.15, reviewZoom + 0.15))}
                  variant="quiet"
                >
                  +
                </Button>
              </div>
              <p className="review-canvas__zoom-help">
                화면 확대는 보기만 바꾸며 저장 결과에 영향이 없습니다
              </p>
              <p>
                {reviewAlignment === "original" ? (
                  "원본 보기 중입니다. 내보내기는 항상 AI 정렬본으로 나갑니다."
                ) : (
                  <>
                    사진을 선택해 위치·회전·배율을 미세 조정하세요. <kbd>\</kbd> 누른 동안 원본 비교
                    · <kbd>[</kbd> <kbd>]</kbd> 회전 0.1° · <kbd>Shift</kbd>+<kbd>[</kbd>{" "}
                    <kbd>]</kbd> 1°
                  </>
                )}
              </p>
            </fieldset>
          ) : null}
        </div>
      </div>
    </header>
  )
}
