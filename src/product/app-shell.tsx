import type { KeyboardEvent, ReactNode } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { AppFooter } from "./app-footer"
import { useGuideColor } from "./guide-color"
import { GuideDialog } from "./guide-dialog"
import { useGuideWidth } from "./guide-width"
import { HelpSurface } from "./help-surface"
import type { WorkspaceStatus } from "./workspace"
import { WorkspaceCommandBar } from "./workspace-command-bar"
import { WorkspaceHeaderHost } from "./workspace-header-action"

export const WORKFLOWS = ["sevenView", "beforeAfter"] as const
export type Workflow = (typeof WORKFLOWS)[number]

type AppShellProps = {
  readonly activeWorkflow: Workflow
  readonly comparison: ReactNode
  readonly comparisonStatus: WorkspaceStatus
  readonly onActiveWorkflowChange: (workflow: Workflow) => void
  readonly sevenView: (onOpenGuide: () => void) => ReactNode
  readonly sevenViewStatus: WorkspaceStatus
}

const WORKFLOW_UI = {
  beforeAfter: {
    headingId: "comparison-heading",
    label: "치료 전후 비교",
    mainId: "comparison-main-content",
    panelId: "comparison-panel",
    statusId: "comparison-workflow-status",
    tabId: "comparison-tab",
  },
  sevenView: {
    headingId: "seven-view-heading",
    label: "임상 사진 정렬",
    mainId: "seven-view-main-content",
    panelId: "seven-view-panel",
    statusId: "seven-view-workflow-status",
    tabId: "seven-view-tab",
  },
} as const satisfies Record<Workflow, Record<string, string>>

function statusLabel(workflow: Workflow, status: WorkspaceStatus): string {
  if (status.exported) return `${WORKFLOW_UI[workflow].label} 저장 완료`
  if (status.dirty) return `${WORKFLOW_UI[workflow].label} 작업 중`
  return `${WORKFLOW_UI[workflow].label} 준비`
}

function focusWorkflowHeading(workflow: Workflow): void {
  const ui = WORKFLOW_UI[workflow]
  const heading = document.getElementById(ui.headingId)
  if (heading === undefined || heading === null) return
  heading.focus()
}

export function AppShell({
  activeWorkflow,
  comparison,
  comparisonStatus,
  onActiveWorkflowChange,
  sevenView,
  sevenViewStatus,
}: AppShellProps) {
  const [guideOpen, setGuideOpen] = useState(false)
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [guideColor, changeGuideColor] = useGuideColor()
  const [guideWidth, changeGuideWidth] = useGuideWidth()
  const startedAt = useRef(Date.now())
  const focusAfterActivation = useRef<"heading" | "tab" | null>(null)
  const activeUi = WORKFLOW_UI[activeWorkflow]
  const activeStatus = activeWorkflow === "sevenView" ? sevenViewStatus : comparisonStatus

  useEffect(() => {
    const needsGuard = [sevenViewStatus, comparisonStatus].some(
      (status) => status.dirty && !status.exported,
    )
    if (!needsGuard) return undefined
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [comparisonStatus, sevenViewStatus])

  useLayoutEffect(() => {
    const focus = focusAfterActivation.current
    focusAfterActivation.current = null
    if (focus === "heading") focusWorkflowHeading(activeWorkflow)
    else if (focus === "tab") document.getElementById(activeUi.tabId)?.focus()
  }, [activeUi.tabId, activeWorkflow])

  const activate = (workflow: Workflow, focus: "heading" | "tab") => {
    if (workflow === activeWorkflow) return
    focusAfterActivation.current = focus
    onActiveWorkflowChange(workflow)
  }
  const handleTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = WORKFLOWS.indexOf(activeWorkflow)
    let nextIndex = currentIndex
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % WORKFLOWS.length
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex + WORKFLOWS.length - 1) % WORKFLOWS.length
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = WORKFLOWS.length - 1
    else return
    event.preventDefault()
    const next = WORKFLOWS[nextIndex]
    if (next !== undefined) activate(next, "tab")
  }

  const navigation = (
    <div aria-label="작업" className="app-shell__tabs" onKeyDown={handleTabKey} role="tablist">
      {WORKFLOWS.map((workflow) => {
        const ui = WORKFLOW_UI[workflow]
        const selected = workflow === activeWorkflow
        return (
          <button
            aria-controls={ui.panelId}
            aria-selected={selected}
            id={ui.tabId}
            key={workflow}
            onClick={() => activate(workflow, "heading")}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {ui.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <WorkspaceHeaderHost value={actionHost}>
      <div className="app-shell">
        <a className="skip-link" href={`#${activeUi.mainId}`}>
          본문으로 건너뛰기
        </a>
        <WorkspaceCommandBar
          activity={
            activeStatus.activity ?? {
              kind: "idle",
              label: statusLabel(activeWorkflow, activeStatus),
            }
          }
          actionSlot={<div className="app-shell__action-slot" ref={setActionHost} />}
          navigation={navigation}
          onNewSet={() => undefined}
          onOpenGuide={() => setGuideOpen(true)}
          privacyState={activeStatus.privacyState ?? "localReady"}
          resetNeedsConfirmation={false}
          showReset={false}
        />
        <div className="app-shell__workspaces">
          {WORKFLOWS.map((workflow) => {
            const ui = WORKFLOW_UI[workflow]
            const active = workflow === activeWorkflow
            const status = workflow === "sevenView" ? sevenViewStatus : comparisonStatus
            return (
              <section
                aria-hidden={!active}
                aria-labelledby={ui.tabId}
                className="app-shell__panel"
                hidden={!active}
                id={ui.panelId}
                inert={!active ? true : undefined}
                key={workflow}
              >
                <main className="app-shell__panel-session" id={ui.mainId} tabIndex={-1}>
                  {workflow === "sevenView" ? sevenView(() => setGuideOpen(true)) : comparison}
                  <span className="sr-only" id={ui.statusId}>
                    {statusLabel(workflow, status)}
                  </span>
                </main>
              </section>
            )
          })}
        </div>
        <AppFooter onOpenHelp={() => setHelpOpen(true)} />
        <GuideDialog onClose={() => setGuideOpen(false)} open={guideOpen} />
        <HelpSurface
          exportCount={(sevenViewStatus.exportCount ?? 0) + (comparisonStatus.exportCount ?? 0)}
          guideColor={guideColor}
          guideWidth={guideWidth}
          onChangeGuideColor={changeGuideColor}
          onChangeGuideWidth={changeGuideWidth}
          onClose={() => setHelpOpen(false)}
          open={helpOpen}
          reviewCount={(sevenViewStatus.reviewCount ?? 0) + (comparisonStatus.reviewCount ?? 0)}
          sessionStartedAt={Math.min(
            sevenViewStatus.sessionStartedAt ?? startedAt.current,
            comparisonStatus.sessionStartedAt ?? startedAt.current,
          )}
        />
      </div>
    </WorkspaceHeaderHost>
  )
}
