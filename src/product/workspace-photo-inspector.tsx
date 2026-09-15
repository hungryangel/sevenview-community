import { EmptySlotPanel } from "./empty-slot-panel"
import { FailureRecoveryPanel } from "./failure-recovery-panel"
import { InspectorPanel } from "./inspector-panel"
import type { useWorkspace } from "./use-workspace"
import type { WorkspaceReview } from "./use-workspace-review"

type WorkspacePhotoInspectorProps = {
  readonly review: WorkspaceReview
  readonly workspace: ReturnType<typeof useWorkspace>
}

export function WorkspacePhotoInspector({ review, workspace }: WorkspacePhotoInspectorProps) {
  const { selectedPhoto, selectedFailure } = review
  if (selectedPhoto === undefined && selectedFailure !== undefined) {
    return (
      <FailureRecoveryPanel
        failure={selectedFailure}
        onAssignManually={() => workspace.assignFailedPhotoManually(workspace.selectedView)}
        onReplace={(file) => void workspace.replaceSlotPhoto(workspace.selectedView, file)}
        onRetry={() => workspace.retryFailedPhoto(workspace.selectedView)}
      />
    )
  }
  if (selectedPhoto === undefined) {
    return (
      <EmptySlotPanel
        onAddPhoto={(file) => void workspace.replaceSlotPhoto(workspace.selectedView, file)}
        view={workspace.selectedView}
      />
    )
  }
  return (
    <InspectorPanel
      key={`${selectedPhoto.pose.id}:${selectedPhoto.view}`}
      hasLateralityConflict={review.lateralityConflicts.some(
        (conflict) => conflict.view === selectedPhoto.view,
      )}
      diagnostics={review.selectedDiagnostics}
      framing={workspace.framingPreset}
      onAssignView={(targetView) => workspace.assignPhotoToView(workspace.selectedView, targetView)}
      onReplace={(file) => void workspace.replaceSlotPhoto(workspace.selectedView, file)}
      onReset={() => workspace.resetAdjustment(workspace.selectedView)}
      onResetAll={workspace.resetAllAdjustments}
      onSwapLaterality={() => workspace.swapLaterality(workspace.selectedView)}
      onDismissDiagnostic={(kind) => workspace.dismissDiagnostic(workspace.selectedView, kind)}
      onRemoveToSpares={() => workspace.removePhotoToSpares(workspace.selectedView)}
      poseMismatch={review.selectedPoseMismatch}
      suggestedView={review.suggestedView}
      views={workspace.viewSet.views}
      onSessionMemoChange={workspace.setSessionMemo}
      onShowCenterGuide={workspace.setShowCenterGuide}
      onShowCropGuide={workspace.setShowCropGuide}
      onShowEyeGuide={workspace.setShowEyeGuide}
      onUpdate={(adjustment) => workspace.updateAdjustment(workspace.selectedView, adjustment)}
      photo={selectedPhoto}
      sessionMemo={workspace.sessionMemo}
      showCenterGuide={workspace.showCenterGuide}
      showCropGuide={workspace.showCropGuide}
      showEyeGuide={workspace.showEyeGuide}
    />
  )
}
