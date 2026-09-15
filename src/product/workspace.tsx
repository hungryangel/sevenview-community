import { useCallback, useEffect, useState } from "react"
import { Notice } from "../ui/notice"
import type { Activity } from "./activity-status"
import { CompletionTransition } from "./completion-transition"
import { EmptyWorkspace } from "./empty-workspace"
import { ExportBar } from "./export-bar"
import { ExportDialog } from "./export-dialog"
import { GuideDialog } from "./guide-dialog"
import { useGlobalFileDrop } from "./use-global-file-drop"
import { useWorkspace } from "./use-workspace"
import { useWorkspaceReview } from "./use-workspace-review"
import { useWorkspaceShellStatus } from "./use-workspace-shell-status"
import { WorkspaceCommandBar } from "./workspace-command-bar"
import { WorkspaceNewSetDialog } from "./workspace-new-set-dialog"
import { WorkspaceReviewNotice } from "./workspace-review-notice"
import { WorkspaceReviewSurface } from "./workspace-review-surface"
import { WorkspaceStandaloneFooter } from "./workspace-standalone-footer"

export type WorkspaceStatus = {
  readonly activity?: Activity
  readonly dirty: boolean
  readonly exportCount?: number
  readonly exported: boolean
  readonly privacyState?: import("../ui/privacy-status").PrivacyState
  readonly reviewCount?: number
  readonly sessionStartedAt?: number
}

type WorkspaceProps = {
  readonly active?: boolean
  readonly embedded?: boolean
  readonly onOpenGuide?: () => void
  readonly onStatusChange?: ((status: WorkspaceStatus) => void) | undefined
}

export function Workspace({
  active = true,
  embedded = false,
  onOpenGuide,
  onStatusChange,
}: WorkspaceProps = {}) {
  const [galleryNoticeHost, setGalleryNoticeHost] = useState<HTMLDivElement | null>(null)
  const [editorNoticeHost, setEditorNoticeHost] = useState<HTMLDivElement | null>(null)
  const workspace = useWorkspace()
  const review = useWorkspaceReview(workspace, active)
  const [guideOpen, setGuideOpen] = useState(false)
  const [newSetOpen, setNewSetOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  useEffect(() => {
    if (active) return
    setExportOpen(false)
    setGuideOpen(false)
    setNewSetOpen(false)
  }, [active])
  const dismissWorkspaceMessage = useCallback(
    () => workspace.setMessage(null),
    [workspace.setMessage],
  )
  const handleDroppedFiles = useCallback(
    (files: readonly File[]) => {
      if (newSetOpen || workspace.phase === "awaitingAnalysis") {
        workspace.appendPendingFiles(files)
        return
      }
      void workspace.processFiles(files)
    },
    [newSetOpen, workspace.phase, workspace.appendPendingFiles, workspace.processFiles],
  )
  const receivingFileDrag = useGlobalFileDrop({
    accepting: newSetOpen || workspace.phase === "empty" || workspace.phase === "awaitingAnalysis",
    active,
    onFiles: handleDroppedFiles,
  })
  const closeNewSet = useCallback(() => {
    setNewSetOpen(false)
    workspace.clearPendingFiles()
  }, [workspace.clearPendingFiles])
  const activity = useWorkspaceShellStatus({ onStatusChange, reviewCount: review.count, workspace })
  const openGuide = onOpenGuide ?? (() => setGuideOpen(true))

  return (
    <div className={`workspace-app${embedded ? " workspace-app--embedded" : ""}`}>
      <WorkspaceReviewNotice
        host={review.inspectorOpenReason === null ? galleryNoticeHost : editorNoticeHost}
        message={workspace.phase === "review" ? workspace.message : null}
        onDismiss={dismissWorkspaceMessage}
      />
      <WorkspaceCommandBar
        active={active}
        embedded={embedded}
        disabled={workspace.exporting || workspace.newSetAnalyzing}
        activity={activity}
        onOpenGuide={openGuide}
        onNewSet={() => setNewSetOpen(true)}
        privacyState={workspace.privacyState}
        resetNeedsConfirmation={
          workspace.phase === "review" &&
          workspace.photos.length > 0 &&
          !workspace.exportedCurrentResult
        }
        showReset={workspace.phase === "review"}
      />

      {workspace.phase === "empty" ||
      workspace.phase === "awaitingAnalysis" ||
      workspace.phase === "analyzing" ? (
        <EmptyWorkspace
          active={active}
          analysisJourney={workspace.analysisJourney}
          compact={workspace.hasCompletedAnalysis}
          dropZoneState={
            receivingFileDrag && workspace.phase === "empty" ? "dragOver" : workspace.dropZoneState
          }
          message={workspace.message}
          onAppendFiles={workspace.appendPendingFiles}
          onCancelAnalysis={workspace.cancelAnalysis}
          onFiles={(files) => void workspace.processFiles(files)}
          onOpenGuide={openGuide}
          onRemovePendingFile={workspace.removePendingFile}
          onStartAnalysis={() => void workspace.startAnalysis()}
          pendingFiles={workspace.pendingFiles.map((pendingFile) => ({
            name: pendingFile.file.name,
            previewUrl: pendingFile.previewUrl,
          }))}
          phase={workspace.phase}
          receivingDrop={receivingFileDrag}
          embedded
        />
      ) : workspace.photos.length === 0 && workspace.failures.length === 0 ? (
        <div className="workspace-fallback">
          {embedded ? (
            <h1 className="sr-only" id="seven-view-heading" tabIndex={-1}>
              임상 사진 정렬 작업
            </h1>
          ) : null}
          <Notice kind="error" title="검토할 사진이 없습니다">
            새 사진을 선택해 작업을 다시 시작해 주세요.
          </Notice>
        </div>
      ) : (
        <CompletionTransition
          active={active}
          items={workspace.photos.map((photo) => ({ framing: workspace.framingPreset, photo }))}
          journey={workspace.analysisJourney}
          revision={workspace.resultRevision}
        >
          <WorkspaceReviewSurface
            embedded={embedded}
            onEditorNoticeHost={setEditorNoticeHost}
            onGalleryNoticeHost={setGalleryNoticeHost}
            review={review}
            workspace={workspace}
          />
          <ExportBar
            disabled={workspace.failures.length > 0 || workspace.photos.length === 0}
            exportCount={workspace.exportCount}
            exportedCurrentResult={workspace.exportedCurrentResult}
            exportedThisSet={workspace.exportedThisSet}
            exporting={workspace.exporting}
            failedCount={workspace.failures.length}
            onOpenExport={() => setExportOpen(true)}
            onNextSet={() => setNewSetOpen(true)}
            patientLabel={workspace.patientLabel}
            photoCount={workspace.photos.length}
            reviewCount={review.count}
            sessionPhotoCount={workspace.sessionPhotoCount}
            totalViews={workspace.viewSet.views.length}
            usage={workspace.usage}
          />
        </CompletionTransition>
      )}
      <ExportDialog
        exportSelection={workspace.exportSelection}
        exporting={workspace.exporting}
        onClose={() => setExportOpen(false)}
        onExport={() => void workspace.exportPng()}
        onExportSelectionChange={workspace.setExportSelection}
        onPatientLabelChange={workspace.setPatientLabel}
        onSessionNameChange={workspace.setSessionName}
        open={exportOpen}
        patientLabel={workspace.patientLabel}
        photoCount={workspace.photos.length}
        sessionName={workspace.sessionName}
      />
      <WorkspaceNewSetDialog
        onClose={closeNewSet}
        onStarted={() => setNewSetOpen(false)}
        open={newSetOpen}
        workspace={workspace}
      />
      {embedded ? null : (
        <GuideDialog onClose={() => setGuideOpen(false)} open={guideOpen} />
      )}
      {embedded ? null : (
        <WorkspaceStandaloneFooter
          exportCount={workspace.exportCount}
          reviewCount={review.count}
          sessionStartedAt={workspace.sessionStartedAt}
        />
      )}
    </div>
  )
}
