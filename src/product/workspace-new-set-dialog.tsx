import { NewSetDialog } from "./new-set-dialog"
import type { useWorkspace } from "./use-workspace"

type WorkspaceNewSetDialogProps = {
  readonly onClose: () => void
  readonly onStarted: () => void
  readonly open: boolean
  readonly workspace: ReturnType<typeof useWorkspace>
}

export function WorkspaceNewSetDialog({
  onClose,
  onStarted,
  open,
  workspace,
}: WorkspaceNewSetDialogProps) {
  return (
    <NewSetDialog
      analyzing={workspace.newSetAnalyzing}
      message={open && workspace.message?.kind === "error" ? workspace.message : null}
      onAppendFiles={workspace.appendPendingFiles}
      onClose={onClose}
      onRemoveFile={(index) => workspace.removePendingFile(index, true)}
      onStart={() =>
        void workspace.startNewSet().then((started) => {
          if (started) {
            onStarted()
          }
        })
      }
      open={open}
      pendingFiles={workspace.pendingFiles.map((pendingFile) => ({
        name: pendingFile.file.name,
        previewUrl: pendingFile.previewUrl,
      }))}
      progress={workspace.progress}
    />
  )
}
