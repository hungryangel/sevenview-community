import { useCallback, useEffect, useRef, useState } from "react"
import { exportWorkspacePngs } from "../adapters/contact-sheet-canvas"
import { releaseImage, releasePreviewUrl } from "../adapters/image-resource"
import {
  type AnalysisJourney,
  advanceAnalysisJourney,
  beginAnalysisJourney,
} from "../domain/analysis-journey"
import {
  type ExifSummary,
  readExifSummary,
  summarizeFilesByCaptureTime,
} from "../domain/exif-capture-time"
import { parseImageFiles } from "../domain/files"
import {
  DEFAULT_FRAMING_PRESET_ID,
  FRAMING_PRESETS,
  type FramingPresetId,
} from "../domain/protocol-preset"
import { createManualWorkspacePhoto, organizeVariableWorkspacePhotos } from "../domain/recovery"
import {
  buildContactSheetFilename,
  buildContactSheetPdfFilename,
  buildContactSheetPptxFilename,
  buildExportBundleFilename,
  buildIndividualViewFilename,
  type ContactSheetExportedEvent,
  countContactSheetExports,
  countExportArtifacts,
  createContactSheetExportedEvent,
  createDefaultSessionName,
  DEFAULT_EXPORT_SELECTION,
  type ExportSelection,
  hasExportOutput,
} from "../domain/session-export"
import {
  cameraLabel,
  detectSessionMixup,
  type SessionMixupSignal,
  type SessionPhotoMeta,
} from "../domain/session-mixup"
import { type CropAdjustment, photoId, type ViewId } from "../domain/types"
import { DEFAULT_VIEW_SET_ID, VIEW_SETS, type ViewSet, type ViewSetId } from "../domain/view-set"
import {
  assignWorkspacePhotoToView,
  DEFAULT_CROP_ADJUSTMENT,
  hasCropAdjustment,
  reorderViewSequence,
  resetWorkspaceAdjustments,
  swapLateralityPair,
  VIEW_LABELS,
  type WorkspacePhoto,
} from "../domain/workspace"
import { analyzeBrowserFiles } from "../services/analyze-local-files"
import type { DropZoneState } from "../ui/drop-zone"
import type { PrivacyState } from "../ui/privacy-status"
import {
  adjustingActivity,
  doneActivity,
  movedActivity,
  RECENT_ACTIVITY_VISIBLE_MS,
  type RecentActivity,
} from "./activity-status"
import { analysisStartFailure } from "./analysis-start-failure"
import { APP_VERSION } from "./app-footer"
import type { CropAlignment } from "./crop-preview"
import { SinglePhotoOperationCoordinator } from "./single-photo-operation-coordinator"
import {
  localStorageOrNull,
  readUsageLedger,
  recordAlignedSet,
  recordExport,
  type UsageLedger,
  writeUsageLedger,
} from "./usage-ledger"
import {
  defaultSelectedView,
  EMPTY_WORKSPACE_CONTENTS,
  type FailedWorkspacePhoto,
  failureMetaKey,
  releaseDiscardedBatch,
  releaseDiscardedImages,
  type SpareWorkspacePhoto,
  type TrayFailure,
  type WorkspaceContents,
  workspaceFromBatch,
} from "./workspace-analysis-result"
import { workspaceFileBoundaryMessage } from "./workspace-file-boundary-message"
import type { PendingWorkspaceFile, WorkspaceMessage } from "./workspace-types"

export type WorkspacePhase = "empty" | "awaitingAnalysis" | "analyzing" | "review"
export type ReviewDisplayMode = "grid" | "single"

export type { FailedWorkspacePhoto, SpareWorkspacePhoto, TrayFailure, WorkspaceMessage }

export function useWorkspace() {
  const [phase, setPhase] = useState<WorkspacePhase>("empty")
  const [photos, setPhotos] = useState<readonly WorkspacePhoto<CanvasImageSource>[]>([])
  const [failures, setFailures] = useState<readonly FailedWorkspacePhoto[]>([])
  const [selectedView, setSelectedView] = useState<ViewId>("front")
  const [privacyState, setPrivacyState] = useState<PrivacyState>("localReady")
  const [dropZoneState, setDropZoneState] = useState<DropZoneState>("empty")
  const [progress, setProgress] = useState(0)
  const [analysisJourney, setAnalysisJourney] = useState<AnalysisJourney>(() =>
    beginAnalysisJourney(0, 0),
  )
  const [message, setMessage] = useState<WorkspaceMessage | null>(null)
  const [exporting, setExporting] = useState(false)
  // 상단 상태 표시용 최근 조작(몇 초 뒤 자동 소멸)과 사용량 장부(2026-09-02 bee 요청).
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null)
  const [usage, setUsage] = useState<UsageLedger>(() => readUsageLedger(localStorageOrNull()))
  const usageRef = useRef(usage)
  const [sessionPhotoCount, setSessionPhotoCount] = useState(0)
  const [newSetAnalyzing, setNewSetAnalyzing] = useState(false)
  useEffect(() => {
    if (recentActivity === null) {
      return undefined
    }
    const timer = window.setTimeout(() => setRecentActivity(null), RECENT_ACTIVITY_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [recentActivity])
  const recordUsage = useCallback((update: (ledger: UsageLedger) => UsageLedger) => {
    const next = update(usageRef.current)
    usageRef.current = next
    setUsage(next)
    writeUsageLedger(localStorageOrNull(), next)
  }, [])
  const [pendingFiles, setPendingFiles] = useState<readonly PendingWorkspaceFile[]>([])
  // 뷰 세트(2026-09-03): 어떤 뷰를 몇 개 쓰는지. 판정·레일·시트·내보내기가 전부 이 세트를 따른다.
  const [viewSetId, setViewSetId] = useState<ViewSetId>(DEFAULT_VIEW_SET_ID)
  const viewSet = VIEW_SETS[viewSetId]
  const viewSetRef = useRef<ViewSet>(viewSet)
  viewSetRef.current = viewSet
  const [sequenceOrder, setSequenceOrder] = useState<readonly ViewId[]>(
    VIEW_SETS[DEFAULT_VIEW_SET_ID].views,
  )
  const [reviewDisplayMode, setReviewDisplayMode] = useState<ReviewDisplayMode>("grid")
  const [reviewAlignment, setReviewAlignment] = useState<CropAlignment>("aligned")
  const [reviewZoom, setReviewZoom] = useState(1)
  const [showCenterGuide, setShowCenterGuide] = useState(true)
  const [showCropGuide, setShowCropGuide] = useState(true)
  const [showEyeGuide, setShowEyeGuide] = useState(true)
  const [dismissedDiagnosticKeys, setDismissedDiagnosticKeys] = useState<readonly string[]>([])
  const [sessionName, setSessionName] = useState(() => createDefaultSessionName(new Date()))
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now())
  const [patientLabel, setPatientLabel] = useState("")
  const [sessionMemo, setSessionMemo] = useState("")
  const [exportSelection, setExportSelection] = useState<ExportSelection>(DEFAULT_EXPORT_SELECTION)
  const [exportEvents, setExportEvents] = useState<readonly ContactSheetExportedEvent[]>([])
  const [hasCompletedAnalysis, setHasCompletedAnalysis] = useState(false)
  const [exportedThisSet, setExportedThisSet] = useState(false)
  const [resultRevision, setResultRevision] = useState(0)
  const [exportedRevision, setExportedRevision] = useState<number | null>(null)
  const resultRevisionRef = useRef(0)
  const workspaceGenerationRef = useRef(0)
  const analysisAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const [mixupSignals, setMixupSignals] = useState<readonly SessionMixupSignal[]>([])
  const [mixupDismissed, setMixupDismissed] = useState(false)
  const [spares, setSpares] = useState<readonly SpareWorkspacePhoto[]>([])
  const [trayFailures, setTrayFailures] = useState<readonly TrayFailure[]>([])
  // 크롭 프레이밍 프리셋 — 사용자 선택은 세트 초기화와 무관하게 유지한다.
  const [framingPresetId, setFramingPresetId] = useState<FramingPresetId>(DEFAULT_FRAMING_PRESET_ID)
  const photosRef = useRef(photos)
  const failuresRef = useRef(failures)
  const sparesRef = useRef(spares)
  const trayFailuresRef = useRef(trayFailures)
  const pendingFilesRef = useRef(pendingFiles)
  const sessionMetasRef = useRef(new Map<string, SessionPhotoMeta>())
  const replacementCounterRef = useRef(0)
  const [singlePhotoOperations] = useState(
    () => new SinglePhotoOperationCoordinator(mountedRef, workspaceGenerationRef),
  )
  const analysisCompletedAtRef = useRef<number | null>(null)
  const markResultChanged = useCallback(() => setResultRevision(++resultRevisionRef.current), [])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      analysisAbortRef.current?.abort()
      singlePhotoOperations.abortAll()
    }
  }, [singlePhotoOperations])

  const recomputeMixup = useCallback(() => {
    setMixupSignals(detectSessionMixup([...sessionMetasRef.current.values()]))
  }, [])

  const resetSessionMetas = useCallback(() => {
    sessionMetasRef.current = new Map()
    setMixupSignals([])
    setMixupDismissed(false)
  }, [])

  const upsertSessionMeta = useCallback((key: string, file: File, summary: ExifSummary) => {
    sessionMetasRef.current.set(key, {
      camera: cameraLabel(summary),
      captureTime: summary.captureTime,
      fileName: file.name,
      key,
    })
  }, [])

  const getPhotoMeta = useCallback((key: string) => sessionMetasRef.current.get(key), [])

  const moveSessionMeta = useCallback((fromKey: string, toKey: string) => {
    const meta = sessionMetasRef.current.get(fromKey)
    if (meta === undefined) {
      return
    }
    sessionMetasRef.current.delete(fromKey)
    sessionMetasRef.current.set(toKey, { ...meta, key: toKey })
  }, [])

  const currentContents = useCallback(
    (): WorkspaceContents => ({
      failures: failuresRef.current,
      photos: photosRef.current,
      spares: sparesRef.current,
      trayFailures: trayFailuresRef.current,
    }),
    [],
  )

  useEffect(
    () => () => {
      releaseDiscardedImages(currentContents(), EMPTY_WORKSPACE_CONTENTS)
      for (const pendingFile of pendingFilesRef.current) {
        releasePreviewUrl(pendingFile.previewUrl)
      }
    },
    [currentContents],
  )

  const replaceWorkspace = useCallback(
    (next: Partial<WorkspaceContents>) => {
      const contents: WorkspaceContents = { ...currentContents(), ...next }
      releaseDiscardedImages(currentContents(), contents)
      photosRef.current = contents.photos
      failuresRef.current = contents.failures
      sparesRef.current = contents.spares
      trayFailuresRef.current = contents.trayFailures
      setPhotos(contents.photos)
      setFailures(contents.failures)
      setSpares(contents.spares)
      setTrayFailures(contents.trayFailures)
      markResultChanged()
    },
    [currentContents, markResultChanged],
  )

  const replacePendingFiles = useCallback((nextPendingFiles: readonly PendingWorkspaceFile[]) => {
    for (const pendingFile of pendingFilesRef.current) {
      releasePreviewUrl(pendingFile.previewUrl)
    }
    pendingFilesRef.current = nextPendingFiles
    setPendingFiles(nextPendingFiles)
  }, [])

  const reset = useCallback(() => {
    analysisAbortRef.current?.abort()
    singlePhotoOperations.abortAll()
    workspaceGenerationRef.current += 1
    replaceWorkspace(EMPTY_WORKSPACE_CONTENTS)
    replacePendingFiles([])
    setPhase("empty")
    setSelectedView("front")
    setSequenceOrder(viewSetRef.current.views)
    setReviewDisplayMode("grid")
    setReviewAlignment("aligned")
    setReviewZoom(1)
    setShowCropGuide(true)
    setShowCenterGuide(true)
    setShowEyeGuide(true)
    setDismissedDiagnosticKeys([])
    setDropZoneState("empty")
    setMessage(null)
    setProgress(0)
    setPrivacyState("localReady")
    setSessionName(createDefaultSessionName(new Date()))
    setSessionStartedAt(Date.now())
    setPatientLabel("")
    setSessionMemo("")
    setSessionPhotoCount(0)
    setRecentActivity(null)
    setExportSelection(DEFAULT_EXPORT_SELECTION)
    setExportEvents([])
    setExportedThisSet(false)
    setExportedRevision(null)
    setExporting(false)
    resetSessionMetas()
    analysisCompletedAtRef.current = null
  }, [replacePendingFiles, replaceWorkspace, resetSessionMetas, singlePhotoOperations])

  const analyzeFiles = useCallback(
    async (files: readonly File[], generation?: number, signal?: AbortSignal) =>
      analyzeBrowserFiles(
        files,
        (processed, total) => setProgress(Math.round((processed / total) * 100)),
        {
          discardDecoded: (decoded) => releaseImage(decoded.image),
          ...(generation === undefined
            ? {}
            : {
                onStage: (event) => {
                  if (event.kind !== "analyzed") return
                  setAnalysisJourney((state) =>
                    advanceAnalysisJourney(state, {
                      type: "itemDetected",
                      generation,
                      index: event.index,
                      sourceSize: {
                        width: event.item.decoded?.width ?? 0,
                        height: event.item.decoded?.height ?? 0,
                      },
                      ...(event.item.kind === "ready" &&
                      event.item.pose.registrationAnchors !== undefined
                        ? { anchors: event.item.pose.registrationAnchors }
                        : {}),
                    }),
                  )
                },
              }),
          ...(signal === undefined ? {} : { signal }),
        },
      ),
    [],
  )

  const processFiles = useCallback(
    async (files: readonly File[]) => {
      const parsed = parseImageFiles(files)
      if (parsed.kind === "rejected") {
        setDropZoneState("invalid")
        setMessage(workspaceFileBoundaryMessage(parsed.error))
        return
      }
      if (files.length === 0) {
        return
      }

      const nextPendingFiles = parsed.files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }))
      replacePendingFiles(nextPendingFiles)
      setPhase("awaitingAnalysis")
      setDropZoneState("empty")
      setMessage(null)
      setProgress(0)
      setPrivacyState("localReady")
    },
    [replacePendingFiles],
  )

  // keepPhase: 툴 안 '새 세트' 대화상자에서 지울 때는 검토 화면을 유지한다.
  const removePendingFile = useCallback((index: number, keepPhase = false) => {
    const current = pendingFilesRef.current
    const target = current[index]
    if (target === undefined) {
      return
    }
    releasePreviewUrl(target.previewUrl)
    const next = current.filter((_, candidateIndex) => candidateIndex !== index)
    pendingFilesRef.current = next
    setPendingFiles(next)
    if (next.length === 0 && !keepPhase) {
      setPhase("empty")
    }
  }, [])

  const clearPendingFiles = useCallback(() => replacePendingFiles([]), [replacePendingFiles])

  const appendPendingFiles = useCallback((files: readonly File[]) => {
    if (files.length === 0) {
      return
    }
    const merged = [...pendingFilesRef.current.map((pending) => pending.file), ...files]
    const parsed = parseImageFiles(merged)
    if (parsed.kind === "rejected") {
      setMessage(workspaceFileBoundaryMessage(parsed.error))
      return
    }
    const additions = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    const next = [...pendingFilesRef.current, ...additions]
    pendingFilesRef.current = next
    setPendingFiles(next)
    setMessage(null)
  }, [])

  // 분석 성공 처리: 결과를 작업대에 올리고 화면과 로컬 사용 기록을 정리합니다.
  const finishAnalysis = useCallback(
    (
      results: Awaited<ReturnType<typeof analyzeFiles>>,
      summarizedFiles: Awaited<ReturnType<typeof summarizeFilesByCaptureTime>>,
    ) => {
      const workspace = workspaceFromBatch(results, viewSetRef.current)
      resetSessionMetas()
      for (const [index, result] of results.entries()) {
        const summarized = summarizedFiles[index]
        if (summarized === undefined) {
          continue
        }
        const key = result.kind === "ready" ? result.pose.id : failureMetaKey(result.file.name)
        upsertSessionMeta(key, result.file, summarized.summary)
      }
      recomputeMixup()
      replaceWorkspace(workspace)
      setSelectedView(defaultSelectedView(workspace.photos, workspace.failures))
      setSequenceOrder(viewSetRef.current.views)
      setReviewDisplayMode("grid")
      setReviewAlignment("aligned")
      setReviewZoom(1)
      setShowCropGuide(true)
      setShowCenterGuide(true)
      setShowEyeGuide(true)
      setDismissedDiagnosticKeys([])
      setDropZoneState("empty")
      setPrivacyState("localReady")
      setPhase("review")
      setHasCompletedAnalysis(true)
      setExportedThisSet(false)
      recordUsage((ledger) => recordAlignedSet(ledger, workspace.photos.length))
      setSessionPhotoCount((count) => count + workspace.photos.length)
      analysisCompletedAtRef.current = Date.now()
      const emptyViewCount =
        viewSetRef.current.views.length - workspace.photos.length - workspace.failures.length
      if (workspace.failures.length > 0 || workspace.trayFailures.length > 0) {
        setMessage({
          kind: "warning",
          title: "일부 사진은 수동 복구가 필요합니다",
          text: `${workspace.photos.length}장은 계속 검토할 수 있습니다. 실패한 슬롯에서 사진을 교체하거나 수동 지정해 주세요.`,
        })
      } else if (emptyViewCount > 0) {
        setMessage({
          kind: "warning",
          title: `${emptyViewCount}개 뷰가 비어 있습니다`,
          text:
            workspace.spares.length > 0
              ? `각도가 맞는 사진이 없는 뷰는 비워 두고, 애매한 사진 ${workspace.spares.length}장은 예비로 옮겼습니다. 빈 슬롯을 선택해 추가하거나 예비에서 직접 배치할 수 있습니다.`
              : "비어 있는 뷰는 '미촬영'으로 내보내지며, 해당 슬롯을 선택해 사진을 추가할 수도 있습니다.",
        })
      } else if (workspace.spares.length > 0) {
        setMessage({
          kind: "success",
          title: "7개 뷰를 제안했습니다",
          text: `자동 결과입니다. 내보내기 전에 방향과 크롭을 확인하세요. 예비 ${workspace.spares.length}장은 레일 아래에서 교체할 수 있습니다.`,
        })
      } else {
        setMessage({
          kind: "success",
          title: "7개 뷰를 제안했습니다",
          text: "자동 결과입니다. 내보내기 전에 방향과 크롭을 확인하세요",
        })
      }
    },
    [recomputeMixup, recordUsage, replaceWorkspace, resetSessionMetas, upsertSessionMeta],
  )

  const startAnalysis = useCallback(async () => {
    const files = pendingFilesRef.current.map((pendingFile) => pendingFile.file)
    if (files.length === 0) {
      return
    }

    analysisAbortRef.current?.abort()
    singlePhotoOperations.abortAll()
    const controller = new AbortController()
    analysisAbortRef.current = controller
    const generation = workspaceGenerationRef.current + 1
    workspaceGenerationRef.current = generation
    setAnalysisJourney(beginAnalysisJourney(generation, files.length))
    setPhase("analyzing")
    setDropZoneState("validating")
    setMessage(null)
    setProgress(0)
    setPrivacyState("modelLoading")

    try {
      const summarizedFiles = await summarizeFilesByCaptureTime(files)
      if (controller.signal.aborted) return
      const pendingByFile = new Map(
        pendingFilesRef.current.map((pendingFile) => [pendingFile.file, pendingFile]),
      )
      const orderedPendingFiles = summarizedFiles.flatMap(({ file }) => {
        const pendingFile = pendingByFile.get(file)
        return pendingFile === undefined ? [] : [pendingFile]
      })
      pendingFilesRef.current = orderedPendingFiles
      setPendingFiles(orderedPendingFiles)
      const results = await analyzeFiles(
        summarizedFiles.map(({ file }) => file),
        generation,
        controller.signal,
      )
      if (controller.signal.aborted || workspaceGenerationRef.current !== generation) {
        releaseDiscardedBatch(results)
        return
      }
      setAnalysisJourney((state) => advanceAnalysisJourney(state, { type: "settled", generation }))
      finishAnalysis(results, summarizedFiles)
      replacePendingFiles([])
      setAnalysisJourney((state) =>
        advanceAnalysisJourney(state, { type: "completed", generation }),
      )
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      const failure = analysisStartFailure(error)
      setPrivacyState("modelError")
      setPhase("awaitingAnalysis")
      setDropZoneState("invalid")
      setMessage({ kind: "error", title: failure.title, text: failure.text })
      setAnalysisJourney((state) =>
        advanceAnalysisJourney(state, { type: "failed", generation, message: failure.text }),
      )
    } finally {
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null
    }
  }, [analyzeFiles, finishAnalysis, replacePendingFiles, singlePhotoOperations])

  const cancelAnalysis = useCallback(() => {
    const generation = workspaceGenerationRef.current
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    setPhase("awaitingAnalysis")
    setDropZoneState("empty")
    setPrivacyState("localReady")
    setAnalysisJourney((state) => advanceAnalysisJourney(state, { type: "cancelled", generation }))
  }, [])

  // 툴 화면 안에서 새 세트 시작(2026-09-02 bee): 지금 세트는 그대로 두고 새 사진을 분석한
  // 뒤, 성공했을 때만 세션 정보를 비우고 교체한다. 실패하면 기존 세트가 남는다.
  const startNewSet = useCallback(async (): Promise<boolean> => {
    const files = pendingFilesRef.current.map((pendingFile) => pendingFile.file)
    if (files.length === 0) {
      return false
    }
    analysisAbortRef.current?.abort()
    singlePhotoOperations.abortAll()
    const controller = new AbortController()
    analysisAbortRef.current = controller
    const generation = workspaceGenerationRef.current + 1
    workspaceGenerationRef.current = generation
    setAnalysisJourney(beginAnalysisJourney(generation, files.length))
    setNewSetAnalyzing(true)
    setProgress(0)
    setMessage(null)
    try {
      const summarizedFiles = await summarizeFilesByCaptureTime(files)
      const results = await analyzeFiles(
        summarizedFiles.map(({ file }) => file),
        generation,
        controller.signal,
      )
      if (controller.signal.aborted || workspaceGenerationRef.current !== generation) {
        releaseDiscardedBatch(results)
        return false
      }
      setAnalysisJourney((state) => advanceAnalysisJourney(state, { type: "settled", generation }))
      setSessionName(createDefaultSessionName(new Date()))
      setSessionStartedAt(Date.now())
      setPatientLabel("")
      setSessionMemo("")
      setExportSelection(DEFAULT_EXPORT_SELECTION)
      setExportEvents([])
      setRecentActivity(null)
      finishAnalysis(results, summarizedFiles)
      replacePendingFiles([])
      setAnalysisJourney((state) =>
        advanceAnalysisJourney(state, { type: "completed", generation }),
      )
      return true
    } catch (error: unknown) {
      if (controller.signal.aborted) return false
      const failure = analysisStartFailure(error)
      setMessage({ kind: "error", title: failure.title, text: failure.text })
      setAnalysisJourney((state) =>
        advanceAnalysisJourney(state, { type: "failed", generation, message: failure.text }),
      )
      return false
    } finally {
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null
        setNewSetAnalyzing(false)
      }
    }
  }, [analyzeFiles, finishAnalysis, replacePendingFiles, singlePhotoOperations])

  const replaceSlotPhoto = useCallback(
    async (view: ViewId, file: File) => {
      const parsed = parseImageFiles([file])
      if (parsed.kind === "rejected") {
        setMessage(workspaceFileBoundaryMessage(parsed.error))
        return
      }

      const operationKey = `slot:${view}`
      const operation = singlePhotoOperations.begin(operationKey)
      setMessage(null)
      setProgress(0)
      setPrivacyState("modelLoading")
      try {
        const summary = await readExifSummary(file)
        if (!singlePhotoOperations.isCurrent(operationKey, operation)) return
        const previousPhotoKey = photosRef.current.find((photo) => photo.view === view)?.pose.id
        const previousFailure = failuresRef.current.find((failure) => failure.view === view)
        const previousKey =
          previousPhotoKey ??
          (previousFailure === undefined ? undefined : failureMetaKey(previousFailure.fileName))
        const results = await analyzeFiles(parsed.files, undefined, operation.controller.signal)
        if (!singlePhotoOperations.isCurrent(operationKey, operation)) {
          releaseDiscardedBatch(results)
          return
        }
        const result = results[0]
        if (result === undefined) {
          throw new Error("Slot replacement did not produce an analysis result")
        }
        releaseDiscardedBatch(results.slice(1))
        if (previousKey !== undefined) {
          sessionMetasRef.current.delete(previousKey)
        }
        if (result.kind === "ready") {
          replacementCounterRef.current += 1
          const replacementPose = {
            ...result.pose,
            id: photoId(`photo-replacement-${replacementCounterRef.current}`),
          }
          upsertSessionMeta(replacementPose.id, result.file, summary)
          recomputeMixup()
          const replacement: WorkspacePhoto<CanvasImageSource> = {
            adjustment: DEFAULT_CROP_ADJUSTMENT,
            assignmentMethod: "auto",
            image: result.decoded.image,
            pose: replacementPose,
            sourceSize: { width: result.decoded.width, height: result.decoded.height },
            view,
          }
          const nextPhotos = [
            ...photosRef.current.filter((photo) => photo.view !== view),
            replacement,
          ]
          const nextFailures = failuresRef.current.filter((failure) => failure.view !== view)
          replaceWorkspace({ photos: nextPhotos, failures: nextFailures })
          setSelectedView(view)
          setMessage({
            kind: "success",
            title: "슬롯 사진을 교체했습니다",
            text: "이 사진만 다시 분석했고 다른 여섯 장의 보정값은 유지했습니다.",
          })
        } else {
          upsertSessionMeta(failureMetaKey(result.file.name), result.file, summary)
          recomputeMixup()
          const failure: FailedWorkspacePhoto = {
            code: result.code,
            decoded:
              result.decoded === null
                ? null
                : {
                    image: result.decoded.image,
                    sourceSize: { width: result.decoded.width, height: result.decoded.height },
                  },
            file: result.file,
            fileName: result.file.name,
            view,
          }
          const nextPhotos = photosRef.current.filter((photo) => photo.view !== view)
          const nextFailures = [
            ...failuresRef.current.filter((existing) => existing.view !== view),
            failure,
          ]
          replaceWorkspace({ photos: nextPhotos, failures: nextFailures })
          setSelectedView(view)
          setMessage({
            kind: "warning",
            title: "교체 사진도 자동 분석하지 못했습니다",
            text: "다시 시도하거나, 미리보기가 있으면 수동 뷰 지정으로 계속 진행할 수 있습니다.",
          })
        }
        setPrivacyState("localReady")
      } catch {
        if (!singlePhotoOperations.isCurrent(operationKey, operation)) return
        setPrivacyState("modelError")
        setMessage({
          kind: "error",
          title: "교체 사진을 분석하지 못했습니다",
          text: "로컬 분석 모델을 시작하지 못했습니다. 브라우저를 새로 열고 다시 시도해 주세요.",
        })
      } finally {
        singlePhotoOperations.finish(operationKey, operation)
      }
    },
    [analyzeFiles, recomputeMixup, replaceWorkspace, singlePhotoOperations, upsertSessionMeta],
  )

  const retryFailedPhoto = useCallback(
    (view: ViewId) => {
      const failure = failuresRef.current.find((candidate) => candidate.view === view)
      if (failure !== undefined) {
        void replaceSlotPhoto(view, failure.file)
      }
    },
    [replaceSlotPhoto],
  )

  const assignFailedPhotoManually = useCallback(
    (view: ViewId) => {
      const failure = failuresRef.current.find((candidate) => candidate.view === view)
      if (failure === undefined || failure.decoded === null) {
        setMessage({
          kind: "warning",
          title: "수동 지정에 사용할 미리보기가 없습니다",
          text: "파일을 해독하지 못한 사진은 다른 원본으로 교체한 뒤 다시 시도해 주세요.",
        })
        return
      }
      const manual = createManualWorkspacePhoto({
        id: photoId(`manual-${view}-${failure.file.name}`),
        image: failure.decoded.image,
        sourceSize: failure.decoded.sourceSize,
        view,
      })
      moveSessionMeta(failureMetaKey(failure.file.name), manual.pose.id)
      recomputeMixup()
      const nextPhotos = [...photosRef.current.filter((photo) => photo.view !== view), manual]
      const nextFailures = failuresRef.current.filter((candidate) => candidate.view !== view)
      replaceWorkspace({ photos: nextPhotos, failures: nextFailures })
      setSelectedView(view)
      setMessage({
        kind: "success",
        title: "수동 뷰로 지정했습니다",
        text: "중앙 기본 크롭으로 시작합니다. 위치·회전·배율을 확인해 조정하세요.",
      })
    },
    [moveSessionMeta, recomputeMixup, replaceWorkspace],
  )

  const dismissMixup = useCallback(() => setMixupDismissed(true), [])

  const swapSpareWithView = useCallback(
    (sparePhotoId: string, view: ViewId) => {
      const spare = sparesRef.current.find((candidate) => candidate.pose.id === sparePhotoId)
      if (spare === undefined || failuresRef.current.some((failure) => failure.view === view)) {
        return
      }
      const displaced = photosRef.current.find((photo) => photo.view === view)
      const nextPhotos = [
        ...photosRef.current.filter((photo) => photo.view !== view),
        {
          ...spare,
          adjustment: DEFAULT_CROP_ADJUSTMENT,
          assignmentMethod: "manual" as const,
          view,
        },
      ]
      const nextSpares = [
        ...sparesRef.current.filter((candidate) => candidate.pose.id !== sparePhotoId),
        ...(displaced === undefined
          ? []
          : [{ image: displaced.image, pose: displaced.pose, sourceSize: displaced.sourceSize }]),
      ]
      replaceWorkspace({ photos: nextPhotos, spares: nextSpares })
      setSelectedView(view)
      setRecentActivity(movedActivity(view, Date.now()))
      setMessage({
        kind: "success",
        title: displaced === undefined ? "예비 사진을 배치했습니다" : "예비 사진과 교체했습니다",
        text:
          displaced === undefined
            ? "빈 뷰에 예비 사진을 배치했습니다. 방향과 크롭을 확인하세요."
            : "기존 사진은 예비로 이동했습니다. 방향과 크롭을 확인하세요.",
      })
    },
    [replaceWorkspace],
  )

  const retryTrayFailure = useCallback(
    async (fileName: string) => {
      const trayFailure = trayFailuresRef.current.find(
        (candidate) => candidate.fileName === fileName,
      )
      if (trayFailure === undefined) {
        return
      }
      const operationKey = `tray:${fileName}`
      const operation = singlePhotoOperations.begin(operationKey)
      setPrivacyState("modelLoading")
      try {
        const results = await analyzeFiles(
          [trayFailure.file],
          undefined,
          operation.controller.signal,
        )
        if (!singlePhotoOperations.isCurrent(operationKey, operation)) {
          releaseDiscardedBatch(results)
          return
        }
        const result = results[0]
        if (result?.kind === "ready") {
          releaseDiscardedBatch(results.slice(1))
          const summary = await readExifSummary(trayFailure.file)
          if (!singlePhotoOperations.isCurrent(operationKey, operation)) {
            releaseImage(result.decoded.image)
            return
          }
          replacementCounterRef.current += 1
          const sparePose = {
            ...result.pose,
            id: photoId(`photo-replacement-${replacementCounterRef.current}`),
          }
          sessionMetasRef.current.delete(failureMetaKey(trayFailure.fileName))
          upsertSessionMeta(sparePose.id, trayFailure.file, summary)
          recomputeMixup()
          replaceWorkspace({
            spares: [
              ...sparesRef.current,
              {
                image: result.decoded.image,
                pose: sparePose,
                sourceSize: { width: result.decoded.width, height: result.decoded.height },
              },
            ],
            trayFailures: trayFailuresRef.current.filter(
              (candidate) => candidate.fileName !== fileName,
            ),
          })
          setMessage({
            kind: "success",
            title: "실패했던 사진을 다시 분석했습니다",
            text: "예비 목록에서 원하는 뷰와 교체할 수 있습니다.",
          })
        } else {
          releaseDiscardedBatch(results)
          setMessage({
            kind: "warning",
            title: "다시 분석해도 얼굴을 찾지 못했습니다",
            text: "이 사진은 다른 원본으로 준비해 주세요.",
          })
        }
        setPrivacyState("localReady")
      } catch {
        if (!singlePhotoOperations.isCurrent(operationKey, operation)) return
        setPrivacyState("modelError")
        setMessage({
          kind: "error",
          title: "다시 분석하지 못했습니다",
          text: "로컬 분석 모델을 시작하지 못했습니다. 브라우저를 새로 열고 다시 시도해 주세요.",
        })
      } finally {
        singlePhotoOperations.finish(operationKey, operation)
      }
    },
    [analyzeFiles, recomputeMixup, replaceWorkspace, singlePhotoOperations, upsertSessionMeta],
  )

  // 검토 중 사진 빼기(2026-09-02 bee 지적): 버리지 않고 예비로 보낸다 —
  // 뷰는 미촬영이 되고, 예비에서 언제든 다시 배치할 수 있다(보정값은 초기화).
  const removePhotoToSpares = useCallback(
    (view: ViewId) => {
      const target = photosRef.current.find((photo) => photo.view === view)
      if (target === undefined) {
        return
      }
      replaceWorkspace({
        photos: photosRef.current.filter((photo) => photo.view !== view),
        spares: [
          ...sparesRef.current,
          { image: target.image, pose: target.pose, sourceSize: target.sourceSize },
        ],
      })
      setRecentActivity(doneActivity("예비로 이동", Date.now()))
      setMessage({
        kind: "success",
        title: "예비로 옮겼습니다",
        text: "이 뷰는 미촬영으로 표시됩니다. 레일의 예비에서 다시 배치할 수 있고, 보정값은 초기화됩니다.",
      })
    },
    [replaceWorkspace],
  )

  const movePhoto = useCallback(
    (view: ViewId, direction: -1 | 1) => {
      markResultChanged()
      setSequenceOrder((current) => {
        const index = current.indexOf(view)
        const targetView = current[index + direction]
        return targetView === undefined ? current : reorderViewSequence(current, view, targetView)
      })
    },
    [markResultChanged],
  )

  const reorderPhoto = useCallback(
    (sourceView: ViewId, targetView: ViewId) => {
      markResultChanged()
      setSequenceOrder((current) => reorderViewSequence(current, sourceView, targetView))
    },
    [markResultChanged],
  )

  // 뷰 세트 전환: 지금 사진(배치본+예비)을 새 세트 기준으로 다시 자동 정렬한다.
  // 세트에 없는 뷰의 분석 실패 항목은 실패 트레이로 내린다. 수동 보정은 초기화된다.
  const changeViewSet = useCallback(
    (next: ViewSetId) => {
      if (next === viewSetId) {
        return
      }
      singlePhotoOperations.abortAll()
      workspaceGenerationRef.current += 1
      markResultChanged()
      const nextSet = VIEW_SETS[next]
      setViewSetId(next)
      viewSetRef.current = nextSet
      setSequenceOrder(nextSet.views)
      const sources = [...photosRef.current, ...sparesRef.current].map(
        ({ image, pose, sourceSize }) => ({ image, pose, sourceSize }),
      )
      if (sources.length > 0 || failuresRef.current.length > 0) {
        const keptFailures = failuresRef.current.filter((failure) =>
          nextSet.views.includes(failure.view),
        )
        const droppedFailures = failuresRef.current.filter(
          (failure) => !nextSet.views.includes(failure.view),
        )
        failuresRef.current = keptFailures
        setFailures(keptFailures)
        if (droppedFailures.length > 0) {
          const nextTray = [
            ...trayFailuresRef.current,
            ...droppedFailures.map((failure) => ({
              code: failure.code,
              decoded: failure.decoded,
              file: failure.file,
              fileName: failure.fileName,
            })),
          ]
          trayFailuresRef.current = nextTray
          setTrayFailures(nextTray)
        }
        const organized = organizeVariableWorkspacePhotos(sources, nextSet)
        replaceWorkspace({ photos: organized.photos, spares: organized.spares })
        setSelectedView(organized.photos[0]?.view ?? nextSet.views[0] ?? "front")
        setMessage({
          kind: "success",
          title: `뷰 세트를 '${nextSet.label}'로 바꿨습니다`,
          text: "새 세트 기준으로 자동 정렬을 다시 했습니다. 수동 보정과 뷰 지정은 초기화됩니다.",
        })
      }
    },
    [markResultChanged, replaceWorkspace, singlePhotoOperations, viewSetId],
  )

  const changeFramingPreset = useCallback(
    (preset: FramingPresetId) => {
      if (preset === framingPresetId) {
        return
      }
      markResultChanged()
      setFramingPresetId(preset)
    },
    [framingPresetId, markResultChanged],
  )

  const assignPhotoToView = useCallback(
    (sourceView: ViewId, targetView: ViewId) => {
      // 대상 뷰를 분석 실패가 차지하고 있으면 실패 트레이로 내린다 — 파일은
      // 잃지 않고(다시 분석 가능), 뷰 자리는 옮겨온 사진이 차지한다.
      const occupyingFailure = failuresRef.current.find((failure) => failure.view === targetView)
      if (occupyingFailure !== undefined) {
        const nextFailures = failuresRef.current.filter((failure) => failure !== occupyingFailure)
        failuresRef.current = nextFailures
        setFailures(nextFailures)
        const nextTray = [
          ...trayFailuresRef.current,
          {
            code: occupyingFailure.code,
            decoded: occupyingFailure.decoded,
            file: occupyingFailure.file,
            fileName: occupyingFailure.fileName,
          },
        ]
        trayFailuresRef.current = nextTray
        setTrayFailures(nextTray)
      }
      const next = assignWorkspacePhotoToView(photosRef.current, sourceView, targetView)
      photosRef.current = next
      setPhotos(next)
      markResultChanged()
      setSelectedView(targetView)
      setRecentActivity(movedActivity(targetView, Date.now()))
    },
    [markResultChanged],
  )

  const swapLaterality = useCallback(
    (view: ViewId) => {
      const next = swapLateralityPair(photosRef.current, view)
      photosRef.current = next
      setPhotos(next)
      markResultChanged()
    },
    [markResultChanged],
  )

  const updateAdjustment = useCallback(
    (view: ViewId, adjustment: CropAdjustment) => {
      setRecentActivity(adjustingActivity(view, Date.now()))
      const previous = photosRef.current.find((photo) => photo.view === view)?.adjustment
      let changed = false
      if (previous !== undefined) {
        for (const axis of ["panX", "panY", "rotationDegrees", "scaleMultiplier"] as const) {
          if (previous[axis] !== adjustment[axis]) {
            changed = true
          }
        }
      }
      if (!changed) {
        return
      }
      markResultChanged()
      setPhotos((current) => {
        const next = current.map((photo) =>
          photo.view === view ? { ...photo, adjustment } : photo,
        )
        photosRef.current = next
        return next
      })
    },
    [markResultChanged],
  )

  const resetAdjustment = useCallback(
    (view: ViewId) => updateAdjustment(view, DEFAULT_CROP_ADJUSTMENT),
    [updateAdjustment],
  )

  const resetAllAdjustments = useCallback(() => {
    if (photosRef.current.some((photo) => hasCropAdjustment(photo.adjustment))) {
      markResultChanged()
    }
    setPhotos((current) => {
      const next = resetWorkspaceAdjustments(current)
      photosRef.current = next
      return next
    })
    setMessage({
      kind: "success",
      title: "전체 보정을 기본값으로 되돌렸습니다",
      text: "뷰 배정과 원본은 유지하고 위치·회전·배율만 초기화했습니다.",
    })
  }, [markResultChanged])

  const dismissDiagnostic = useCallback((view: ViewId, kind: string) => {
    const key = `${view}:${kind}`
    setDismissedDiagnosticKeys((current) => (current.includes(key) ? current : [...current, key]))
  }, [])

  const exportPng = useCallback(async () => {
    if (
      photosRef.current.length === 0 ||
      failuresRef.current.length > 0 ||
      !hasExportOutput(exportSelection)
    ) {
      return
    }
    setExporting(true)
    setMessage(null)
    const exportedInputRevision = resultRevisionRef.current
    const exportedWorkspaceGeneration = workspaceGenerationRef.current
    try {
      const sheetFooter = `${sessionName}${patientLabel === "" ? "" : ` · ${patientLabel}`} · 좌우: 환자 기준 · SevenView by VELNOC v${APP_VERSION}`
      const contactSheet = exportSelection.contactSheet
        ? {
            filename: buildContactSheetFilename({ patientLabel, sessionName }),
            footer: sheetFooter,
          }
        : undefined
      const contactSheetPdf = exportSelection.pdf
        ? { filename: buildContactSheetPdfFilename({ patientLabel, sessionName }) }
        : undefined
      const contactSheetPptx = exportSelection.pptx
        ? { filename: buildContactSheetPptxFilename({ patientLabel, sessionName }) }
        : undefined
      const individualPngs = exportSelection.individualPngs
        ? photosRef.current.map((photo, index) =>
            buildIndividualViewFilename({
              index: index + 1,
              patientLabel,
              sessionName,
              viewLabel: VIEW_LABELS[photo.view],
            }),
          )
        : undefined
      const result = await exportWorkspacePngs(photosRef.current, {
        framing: FRAMING_PRESETS[framingPresetId],
        viewSet: viewSetRef.current,
        sheetFooter,
        bundleFilename: buildExportBundleFilename({ patientLabel, sessionName }),
        ...(contactSheet === undefined ? {} : { contactSheet }),
        ...(contactSheetPdf === undefined ? {} : { contactSheetPdf }),
        ...(contactSheetPptx === undefined ? {} : { contactSheetPptx }),
        ...(individualPngs === undefined ? {} : { individualPngs }),
      })
      if (!mountedRef.current || workspaceGenerationRef.current !== exportedWorkspaceGeneration) {
        return
      }
      if (result.contactSheetExported) {
        setExportEvents((current) => [...current, createContactSheetExportedEvent(sessionName)])
      }
      setExportedThisSet(true)
      if (mountedRef.current && resultRevisionRef.current === exportedInputRevision) {
        setExportedRevision(exportedInputRevision)
      }
      recordUsage(recordExport)
      const outputs = [
        exportSelection.contactSheet ? "컨택트 시트 PNG" : null,
        exportSelection.pdf ? "PDF" : null,
        exportSelection.pptx ? "PPT 슬라이드" : null,
        exportSelection.individualPngs ? `개별 ${photosRef.current.length}장 PNG` : null,
      ].filter((output): output is string => output !== null)
      const bundled = countExportArtifacts(exportSelection, photosRef.current.length) > 1
      setRecentActivity(doneActivity("다운로드 요청 완료", Date.now()))
      setMessage({
        kind: "success",
        title: "다운로드를 요청했습니다",
        text: `원본은 변경되지 않았고, ${outputs.join("·")}을(를) ${bundled ? "ZIP 한 파일로" : "한 파일로"} 생성했습니다. 다운로드 폴더에서 파일을 확인해 주세요.`,
      })
    } catch {
      if (mountedRef.current && workspaceGenerationRef.current === exportedWorkspaceGeneration) {
        setMessage({
          kind: "error",
          title: "파일을 만들지 못했습니다",
          text: "브라우저의 다운로드 권한을 확인하고 다시 시도해 주세요.",
        })
      }
    } finally {
      if (mountedRef.current && workspaceGenerationRef.current === exportedWorkspaceGeneration) {
        setExporting(false)
      }
    }
  }, [exportSelection, framingPresetId, patientLabel, recordUsage, sessionName])

  const changePatientLabel = useCallback(
    (next: string) => {
      if (next !== patientLabel) {
        markResultChanged()
        setPatientLabel(next)
      }
    },
    [markResultChanged, patientLabel],
  )
  const changeSessionMemo = useCallback(
    (next: string) => {
      if (next !== sessionMemo) {
        markResultChanged()
        setSessionMemo(next)
      }
    },
    [markResultChanged, sessionMemo],
  )
  const changeSessionName = useCallback(
    (next: string) => {
      if (next !== sessionName) {
        markResultChanged()
        setSessionName(next)
      }
    },
    [markResultChanged, sessionName],
  )

  const mixupOffenderKeys = new Set(mixupSignals.flatMap((signal) => signal.offenders))
  const hasReviewContents =
    phase === "review" &&
    (photos.length > 0 || failures.length > 0 || spares.length > 0 || trayFailures.length > 0)
  const hasPendingWork = pendingFiles.length > 0 || phase === "analyzing"
  const exportedCurrentResult = hasReviewContents && exportedRevision === resultRevision
  const hasUnexportedChanges = hasPendingWork || (hasReviewContents && !exportedCurrentResult)
  const mixupOffenderViews: readonly ViewId[] = [
    ...photos.filter((photo) => mixupOffenderKeys.has(photo.pose.id)).map((photo) => photo.view),
    ...failures
      .filter((failure) => mixupOffenderKeys.has(failureMetaKey(failure.fileName)))
      .map((failure) => failure.view),
  ]

  return {
    analysisJourney,
    assignFailedPhotoManually,
    assignPhotoToView,
    changeFramingPreset,
    changeViewSet,
    framingPreset: FRAMING_PRESETS[framingPresetId],
    viewSet,
    recentActivity,
    sessionPhotoCount,
    usage,
    clearPendingFiles,
    cancelAnalysis,
    getPhotoMeta,
    newSetAnalyzing,
    startNewSet,
    dismissMixup,
    dropZoneState,
    dismissedDiagnosticKeys,
    dismissDiagnostic,
    exportCount: countContactSheetExports(exportEvents),
    exportEvents,
    exportSelection,
    exportedThisSet,
    exportedCurrentResult,
    exporting,
    exportPng,
    failures,
    hasCompletedAnalysis,
    hasUnexportedChanges,
    message,
    mixupDismissed,
    mixupOffenderViews,
    mixupSignals,
    movePhoto,
    phase,
    pendingFiles,
    patientLabel,
    photos,
    privacyState,
    processFiles,
    progress,
    resultRevision,
    removePendingFile,
    removePhotoToSpares,
    appendPendingFiles,
    replaceSlotPhoto,
    reset,
    resetAdjustment,
    resetAllAdjustments,
    retryTrayFailure,
    reviewAlignment,
    reviewDisplayMode,
    reviewZoom,
    reorderPhoto,
    setReviewAlignment,
    setShowEyeGuide,
    showEyeGuide,
    sequenceOrder,
    retryFailedPhoto,
    spares,
    swapSpareWithView,
    trayFailures,
    selectedView,
    setMessage,
    setExportSelection,
    setPatientLabel: changePatientLabel,
    setReviewDisplayMode,
    setReviewZoom,
    setShowCenterGuide,
    setShowCropGuide,
    setSelectedView,
    setSessionMemo: changeSessionMemo,
    setSessionName: changeSessionName,
    swapLaterality,
    startAnalysis,
    showCenterGuide,
    showCropGuide,
    sessionMemo,
    sessionName,
    sessionStartedAt,
    updateAdjustment,
  }
}
