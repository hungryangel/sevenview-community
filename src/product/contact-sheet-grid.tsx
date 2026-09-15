import { MagnifyingGlass } from "@phosphor-icons/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { isDetectionWeak } from "../domain/detection-quality"
import type { FramingPreset } from "../domain/protocol-preset"
import type { SessionPhotoMeta } from "../domain/session-mixup"
import type { ViewId } from "../domain/types"
import type { LateralityConflict, WorkspacePhoto } from "../domain/workspace"
import { hasCropAdjustment, VIEW_LABELS } from "../domain/workspace"
import { ViewSlot } from "../ui/view-slot"
import { analysisFailureCopy } from "./analysis-failure-copy"
import { ContactSheetHeader } from "./contact-sheet-header"
import { type CropAlignment, CropPreview } from "./crop-preview"
import { describePhotoDetail } from "./photo-detail"
import type { FailedWorkspacePhoto } from "./use-workspace"

export type ContactSheetGridProps = {
  readonly headingId?: string
  readonly framing: FramingPreset
  readonly photoMetaFor: (photoId: string) => SessionPhotoMeta | undefined
  readonly onResetSelectedAdjustment: () => void
  readonly selectedPhotoAdjusted: boolean
  readonly selectedViewLabel: string
  readonly failures: readonly FailedWorkspacePhoto[]
  readonly lateralityConflicts: readonly LateralityConflict[]
  readonly mismatchViews: readonly ViewId[]
  readonly mixupViews: readonly ViewId[]
  readonly onSelect: (view: ViewId) => void
  readonly inspectorOpen: boolean
  readonly onOpenInspector: () => void
  readonly onStartReview: (() => void) | null
  readonly onSetReviewAlignment: (alignment: CropAlignment) => void
  readonly onSetReviewDisplayMode: (mode: "grid" | "single") => void
  readonly onSetReviewZoom: (zoom: number) => void
  readonly photos: readonly WorkspacePhoto<CanvasImageSource>[]
  readonly reviewAlignment: CropAlignment
  readonly selectedView: ViewId
  readonly views: readonly ViewId[]
  readonly reviewDisplayMode: "grid" | "single"
  readonly reviewZoom: number
  readonly showCropGuide?: boolean
  readonly showCenterGuide?: boolean
  readonly showEyeGuide?: boolean
  // 제목 아래 도구막대 슬롯(뷰 세트·프레이밍 칩) — 작업 도구는 설정이 아니라 화면에 둔다(2026-09-03).
  readonly toolbar?: ReactNode
}

export function ContactSheetGrid(props: ContactSheetGridProps) {
  const {
    headingId = "review-title",
    framing,
    photoMetaFor,
    failures,
    lateralityConflicts,
    mismatchViews,
    mixupViews,
    onSelect,
    inspectorOpen,
    photos,
    reviewAlignment,
    reviewDisplayMode,
    reviewZoom,
    selectedView,
    showCropGuide = true,
    showCenterGuide = true,
    showEyeGuide = true,
    views,
  } = props
  const gridRef = useRef<HTMLDivElement>(null)
  const visibleViews = reviewDisplayMode === "single" ? [selectedView] : views
  useEffect(() => {
    const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>(".view-slot") ?? []
    for (const button of buttons) {
      button.setAttribute("aria-controls", "workspace-inspector")
      button.setAttribute(
        "aria-expanded",
        String(inspectorOpen && button.getAttribute("aria-current") === "true"),
      )
    }
  })
  // 타일별 확대경(2026-09-03 bee): 타일 모서리의 돋보기 버튼으로 그 칸에서만 켠다.
  const [magnifiedViews, setMagnifiedViews] = useState<ReadonlySet<ViewId>>(() => new Set())
  const toggleMagnifier = (view: ViewId) =>
    setMagnifiedViews((current) => {
      const next = new Set(current)
      if (next.has(view)) {
        next.delete(view)
      } else {
        next.add(view)
      }
      return next
    })

  return (
    <section className="review-canvas" aria-labelledby={headingId}>
      <ContactSheetHeader {...props} />
      <div
        className={`contact-sheet-grid contact-sheet-grid--${reviewDisplayMode}`}
        data-review-zoom={reviewZoom}
        ref={gridRef}
      >
        {visibleViews.map((view) => {
          const index = views.indexOf(view)
          const photo = photos.find((candidate) => candidate.view === view)
          const failure = failures.find((candidate) => candidate.view === view)
          const lateralityConflict = lateralityConflicts.some((conflict) => conflict.view === view)
          const mixupSuspect = mixupViews.includes(view)
          const poseMismatch = mismatchViews.includes(view)
          const weakDetection =
            photo !== undefined && isDetectionWeak(photo.view, photo.pose.confidence)
          const state =
            failure !== undefined
              ? "error"
              : photo === undefined
                ? "empty"
                : lateralityConflict || mixupSuspect || poseMismatch || weakDetection
                  ? "warning"
                  : "ready"
          return (
            <ViewSlot
              adjusted={photo !== undefined && hasCropAdjustment(photo.adjustment)}
              assignmentMethod={photo?.assignmentMethod}
              detail={
                photo === undefined ? undefined : (
                  <dl>
                    {describePhotoDetail(photo, photoMetaFor(photo.pose.id)).map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                )
              }
              index={index + 1}
              key={view}
              label={VIEW_LABELS[view]}
              onSelect={() => onSelect(view)}
              preview={
                photo === undefined ? undefined : (
                  <CropPreview
                    framing={framing}
                    alignment={reviewAlignment}
                    magnifier={magnifiedViews.has(view)}
                    photo={photo}
                    quality="review"
                    showCropGuide={showCropGuide}
                    showCenterGuide={showCenterGuide}
                    showEyeGuide={showEyeGuide}
                    zoom={reviewZoom}
                  />
                )
              }
              selected={view === selectedView}
              sourcePhotoId={photo?.pose.id}
              state={state}
              tools={
                photo === undefined ? undefined : (
                  <button
                    aria-label={`${VIEW_LABELS[view]} 확대경 ${magnifiedViews.has(view) ? "끄기" : "켜기"}`}
                    aria-pressed={magnifiedViews.has(view)}
                    className="view-slot__tool"
                    onClick={() => toggleMagnifier(view)}
                    title="이 칸에서 확대경 켬/끔"
                    type="button"
                  >
                    <MagnifyingGlass aria-hidden="true" size={14} weight="bold" />
                  </button>
                )
              }
              statusText={
                failure !== undefined
                  ? analysisFailureCopy(failure.code)
                  : photo === undefined
                    ? "미촬영"
                    : lateralityConflict
                      ? "좌우 확인"
                      : mixupSuspect
                        ? "혼입 확인"
                        : poseMismatch
                          ? "각도 불일치"
                          : weakDetection
                            ? "기준점 흐림"
                            : undefined
              }
              variant="contactSheet"
            />
          )
        })}
      </div>
    </section>
  )
}
