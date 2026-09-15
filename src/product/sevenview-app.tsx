import { type ComponentType, useCallback, useState } from "react"

import { AppShell, type Workflow } from "./app-shell"
import { ComparisonWorkspace } from "./comparison-workspace"
import { Workspace, type WorkspaceStatus } from "./workspace"

type WorkspaceSurfaceProps = {
  readonly active: boolean
  readonly embedded?: boolean
  readonly onOpenGuide?: () => void
  readonly onStatusChange: (status: WorkspaceStatus) => void
}

type ComparisonSurfaceProps = {
  readonly active: boolean
  readonly onStatusChange: (status: WorkspaceStatus) => void
}

type SevenViewAppProps = {
  readonly ComparisonSurface?: ComponentType<ComparisonSurfaceProps>
  readonly SevenViewSurface?: ComponentType<WorkspaceSurfaceProps>
}

const CLEAN_STATUS: WorkspaceStatus = { dirty: false, exported: false }

export function SevenViewApp({
  ComparisonSurface = ComparisonWorkspace,
  SevenViewSurface = Workspace,
}: SevenViewAppProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow>("sevenView")
  const [comparisonStatus, setComparisonStatus] = useState<WorkspaceStatus>(CLEAN_STATUS)
  const [sevenViewStatus, setSevenViewStatus] = useState<WorkspaceStatus>(CLEAN_STATUS)
  const changeWorkflow = useCallback((workflow: Workflow) => {
    setActiveWorkflow(workflow)
  }, [])

  return (
    <AppShell
      activeWorkflow={activeWorkflow}
      comparison={
        <ComparisonSurface
          active={activeWorkflow === "beforeAfter"}
          onStatusChange={setComparisonStatus}
        />
      }
      comparisonStatus={comparisonStatus}
      onActiveWorkflowChange={changeWorkflow}
      sevenView={(onOpenGuide) => (
        <SevenViewSurface
          active={activeWorkflow === "sevenView"}
          embedded
          onOpenGuide={onOpenGuide}
          onStatusChange={setSevenViewStatus}
        />
      )}
      sevenViewStatus={sevenViewStatus}
    />
  )
}
