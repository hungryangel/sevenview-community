export type PendingWorkspaceFile = {
  readonly file: File
  readonly previewUrl: string
}

export type WorkspaceMessage = {
  readonly kind: "error" | "success" | "warning"
  readonly text: string
  readonly title: string
}
