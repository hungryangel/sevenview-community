import { useEffect, useMemo } from "react"
import { deriveActivity } from "./activity-status"
import type { useWorkspace } from "./use-workspace"
import type { WorkspaceStatus } from "./workspace"

type WorkspaceShellStatusOptions = {
  readonly onStatusChange?: ((status: WorkspaceStatus) => void) | undefined
  readonly reviewCount: number
  readonly workspace: ReturnType<typeof useWorkspace>
}

export function useWorkspaceShellStatus({
  onStatusChange,
  reviewCount,
  workspace,
}: WorkspaceShellStatusOptions) {
  const activity = useMemo(
    () =>
      deriveActivity({
        errorTitle: workspace.message?.kind === "error" ? workspace.message.title : null,
        exporting: workspace.exporting,
        newSetAnalyzing: workspace.newSetAnalyzing,
        now: Date.now(),
        pendingCount: workspace.pendingFiles.length,
        phase: workspace.phase,
        progress: workspace.progress,
        recent: workspace.recentActivity,
        selectedView: workspace.selectedView,
      }),
    [
      workspace.exporting,
      workspace.message,
      workspace.newSetAnalyzing,
      workspace.pendingFiles.length,
      workspace.phase,
      workspace.progress,
      workspace.recentActivity,
      workspace.selectedView,
    ],
  )

  useEffect(() => {
    onStatusChange?.({
      activity,
      dirty: workspace.hasUnexportedChanges,
      exportCount: workspace.exportCount,
      exported: workspace.exportedCurrentResult,
      privacyState: workspace.privacyState,
      reviewCount,
      sessionStartedAt: workspace.sessionStartedAt,
    })
  }, [
    activity,
    onStatusChange,
    reviewCount,
    workspace.exportCount,
    workspace.exportedCurrentResult,
    workspace.hasUnexportedChanges,
    workspace.privacyState,
    workspace.sessionStartedAt,
  ])

  return activity
}
