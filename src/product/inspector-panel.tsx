import type { FramingPreset } from "../domain/protocol-preset"
import type { ReviewDiagnostic } from "../domain/review-diagnostics"
import type { CropAdjustment, ViewId } from "../domain/types"
import type { PoseMismatch } from "../domain/view-plausibility"
import type { WorkspacePhoto } from "../domain/workspace"
import { VIEW_LABELS } from "../domain/workspace"
import { AdjustmentReadout } from "./adjustment-readout"
import { CropPreview } from "./crop-preview"
import { InspectorAdjustmentControls } from "./inspector-adjustment-controls"
import { InspectorPhotoActions, useInspectorReplacement } from "./inspector-photo-actions"
import { InspectorPhotoDetails, InspectorReviewWarnings } from "./inspector-photo-details"
import { useInspectorLeveling } from "./use-inspector-leveling"

export type InspectorPanelProps = {
  readonly hasLateralityConflict: boolean
  readonly diagnostics: readonly ReviewDiagnostic[]
  readonly framing: FramingPreset
  readonly onAssignView: (targetView: ViewId) => void
  readonly onRemoveToSpares: () => void
  readonly onReset: () => void
  readonly onResetAll: () => void
  readonly onReplace: (file: File) => void
  readonly onSwapLaterality: () => void
  readonly onDismissDiagnostic: (kind: ReviewDiagnostic["kind"]) => void
  readonly onSessionMemoChange: (memo: string) => void
  readonly onShowCropGuide: (show: boolean) => void
  readonly onShowCenterGuide: (show: boolean) => void
  readonly onShowEyeGuide: (show: boolean) => void
  readonly onUpdate: (adjustment: CropAdjustment) => void
  readonly photo: WorkspacePhoto<CanvasImageSource>
  readonly poseMismatch: PoseMismatch | null
  readonly sessionMemo: string
  readonly suggestedView: ViewId | null
  readonly views: readonly ViewId[]
  readonly showCropGuide: boolean
  readonly showCenterGuide: boolean
  readonly showEyeGuide: boolean
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { photo, framing, views, showCropGuide, showCenterGuide, showEyeGuide } = props
  const level = useInspectorLeveling(photo.adjustment, props.onUpdate)
  const replacement = useInspectorReplacement(props.onReplace)
  const selectedViewNumber = views.indexOf(photo.view) + 1
  return (
    <aside className="inspector-panel" aria-labelledby="inspector-title">
      <div className="panel-heading">
        <span>선택한 뷰</span>
        <div className="inspector-panel__selection" id="inspector-title">
          <span>{selectedViewNumber}</span>
          <strong>{VIEW_LABELS[photo.view]}</strong>
          {photo.assignmentMethod === "auto" ? <small>권장</small> : null}
        </div>
      </div>
      <div className="inspector-panel__body">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Accessible replacement file input is in the controls column; this region adds the pointer drop path. */}
        <div
          className={`inspector-panel__preview${replacement.replaceDropActive ? " inspector-panel__preview--drop" : ""}`}
          onDragLeave={replacement.handleReplaceDragLeave}
          onDragOver={replacement.handleReplaceDragOver}
          onDrop={replacement.handleReplaceDrop}
        >
          <CropPreview
            framing={framing}
            line={level.levelLine}
            magnifier
            marks={level.levelPoints}
            onPointPick={
              level.leveling && level.levelPending === null ? level.pickLevelPoint : undefined
            }
            photo={photo}
            quality="review"
            editing
            showCropGuide={showCropGuide}
            showCenterGuide={showCenterGuide}
            showEyeGuide={showEyeGuide}
          />
          <AdjustmentReadout adjustment={photo.adjustment} />
        </div>
        <section className="inspector-panel__scroll" aria-label="사진 조정 도구">
          <InspectorReviewWarnings {...props} />
          <InspectorAdjustmentControls {...props} level={level} />
          <InspectorPhotoActions {...props} replacement={replacement} />
          <InspectorPhotoDetails {...props} />
        </section>
      </div>
    </aside>
  )
}
