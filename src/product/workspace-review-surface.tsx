import { hasCropAdjustment, VIEW_LABELS } from "../domain/workspace"
import { ContactSheetGrid } from "./contact-sheet-grid"
import { InspectorSurface } from "./inspector-surface"
import { ProtocolToolbar } from "./protocol-toolbar"
import { SequenceRail } from "./sequence-rail"
import { SessionMixupNotice } from "./session-mixup-notice"
import type { useWorkspace } from "./use-workspace"
import type { WorkspaceReview } from "./use-workspace-review"
import { WorkspacePhotoInspector } from "./workspace-photo-inspector"
import { WorkspaceSetOverview } from "./workspace-set-overview"
import "../styles/workspace-set-overview.css"

type WorkspaceReviewSurfaceProps = {
  readonly embedded: boolean
  readonly onEditorNoticeHost: (host: HTMLDivElement | null) => void
  readonly onGalleryNoticeHost: (host: HTMLDivElement | null) => void
  readonly review: WorkspaceReview
  readonly workspace: ReturnType<typeof useWorkspace>
}

export function WorkspaceReviewSurface({
  embedded,
  onEditorNoticeHost,
  onGalleryNoticeHost,
  review,
  workspace,
}: WorkspaceReviewSurfaceProps) {
  const inspectorOpen = review.inspectorOpenReason !== null
  const { nextTarget, previousTarget } = review
  const Surface = embedded ? "div" : "main"
  return (
    <Surface
      id={embedded ? undefined : "main-content"}
      tabIndex={embedded ? undefined : -1}
      className="workspace-shell"
      data-review-first-target={review.firstTarget ?? undefined}
      data-review-next-target={review.nextTarget ?? undefined}
      data-review-previous-target={review.previousTarget ?? undefined}
    >
      <SequenceRail
        failures={workspace.failures}
        framing={workspace.framingPreset}
        lateralityConflicts={review.lateralityConflicts}
        mismatchViews={review.poseMismatchViews}
        mixupViews={workspace.mixupOffenderViews}
        onMove={workspace.movePhoto}
        onReorder={workspace.reorderPhoto}
        onRetryTrayFailure={(fileName) => void workspace.retryTrayFailure(fileName)}
        onSelect={review.selectManually}
        inspectorOpen={inspectorOpen}
        onSwapSpare={(sparePhotoId, targetView) =>
          workspace.swapSpareWithView(sparePhotoId, targetView)
        }
        photos={workspace.photos}
        pitchMedian={review.pitchMedian}
        sequenceOrder={workspace.sequenceOrder}
        selectedView={workspace.selectedView}
        spares={workspace.spares}
        trayFailures={workspace.trayFailures}
      />
      <div
        className="workspace-shell__center"
        inert={inspectorOpen ? true : undefined}
        aria-hidden={inspectorOpen ? true : undefined}
      >
        {workspace.mixupDismissed ? null : (
          <SessionMixupNotice onDismiss={workspace.dismissMixup} signals={workspace.mixupSignals} />
        )}
        <div ref={onGalleryNoticeHost} />
        <WorkspaceSetOverview
          workspace={workspace}
          reviewQueue={review.queue}
          onSelect={review.selectManually}
        />
        <ContactSheetGrid
          showCropGuide={workspace.showCropGuide}
          showCenterGuide={workspace.showCenterGuide}
          showEyeGuide={workspace.showEyeGuide}
          headingId={embedded ? "seven-view-heading" : "review-title"}
          failures={workspace.failures}
          framing={workspace.framingPreset}
          views={workspace.viewSet.views}
          toolbar={
            <ProtocolToolbar
              framing={workspace.framingPreset}
              onChangeFramingPreset={workspace.changeFramingPreset}
              onChangeViewSet={workspace.changeViewSet}
              photos={workspace.photos}
              previewPhoto={review.selectedPhoto ?? workspace.photos[0] ?? null}
              spares={workspace.spares}
              viewSet={workspace.viewSet}
            />
          }
          photoMetaFor={workspace.getPhotoMeta}
          onResetSelectedAdjustment={() => workspace.resetAdjustment(workspace.selectedView)}
          selectedPhotoAdjusted={
            review.selectedPhoto !== undefined && hasCropAdjustment(review.selectedPhoto.adjustment)
          }
          selectedViewLabel={VIEW_LABELS[workspace.selectedView]}
          lateralityConflicts={review.lateralityConflicts}
          mismatchViews={review.poseMismatchViews}
          mixupViews={workspace.mixupOffenderViews}
          onSelect={review.selectManually}
          inspectorOpen={inspectorOpen}
          onOpenInspector={() => review.openInspector("manual")}
          onStartReview={review.firstTarget === null ? null : review.startReview}
          onSetReviewAlignment={workspace.setReviewAlignment}
          onSetReviewDisplayMode={workspace.setReviewDisplayMode}
          onSetReviewZoom={workspace.setReviewZoom}
          photos={workspace.photos}
          reviewAlignment={workspace.reviewAlignment}
          reviewDisplayMode={workspace.reviewDisplayMode}
          reviewZoom={workspace.reviewZoom}
          selectedView={workspace.selectedView}
        />
      </div>
      {inspectorOpen ? (
        <InspectorSurface
          noticeHostRef={onEditorNoticeHost}
          onClose={review.closeInspector}
          onNext={nextTarget === null ? null : () => workspace.setSelectedView(nextTarget)}
          onPrevious={
            previousTarget === null ? null : () => workspace.setSelectedView(previousTarget)
          }
        >
          <WorkspacePhotoInspector review={review} workspace={workspace} />
        </InspectorSurface>
      ) : null}
    </Surface>
  )
}
