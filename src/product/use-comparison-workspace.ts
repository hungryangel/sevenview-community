import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"

import { releaseImage, releasePreviewUrl } from "../adapters/image-resource"
import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import {
  type ComparisonExportSettings,
  createComparisonExportSettings,
} from "../domain/comparison-export"
import type { EyePrivacyRaster } from "../domain/comparison-eye-privacy"
import type { ComparisonReferencePair } from "../domain/comparison-reference-pair"
import type { ComparisonSlot } from "../domain/comparison-session"
import { parseImageFiles } from "../domain/files"
import { createDefaultSessionName } from "../domain/session-export"
import { analyzeBrowserFiles } from "../services/analyze-local-files"
import { recordUsageEvent } from "../usage/usage-events"
import type { ReadyComparisonSlot } from "./comparison-preview"
import {
  buildComparisonRenderModel,
  type ComparisonRenderModel,
  EMPTY_COMPARISON_ADJUSTMENT,
} from "./comparison-render-model"
import type { ComparisonWorkspaceDependencies } from "./comparison-workspace-types"
import { useComparisonAlignment } from "./use-comparison-alignment"
import { canAnalyzeComparisonPending, useComparisonAnalysis } from "./use-comparison-analysis"
import { useComparisonExport } from "./use-comparison-export"
import { useComparisonEyePrivacy } from "./use-comparison-eye-privacy"
import { useComparisonSession } from "./use-comparison-session"

export type { ComparisonWorkspaceDependencies } from "./comparison-workspace-types"

const DEFAULT_DEPENDENCIES: ComparisonWorkspaceDependencies = {
  analyzeFiles: analyzeBrowserFiles,
  createPreviewUrl: (file) => URL.createObjectURL(file),
  releaseImage,
  releasePreviewUrl,
}

function matchesReferenceSource(
  current: ComparisonSlot<CanvasImageSource>,
  candidate: ReadyComparisonSlot,
): boolean {
  switch (current.kind) {
    case "ready":
    case "manual":
      return current.file === candidate.file && current.decoded === candidate.decoded
    case "error":
      return (
        current.code === "face_not_detected" &&
        current.decoded !== undefined &&
        current.file === candidate.file &&
        current.decoded === candidate.decoded
      )
    case "empty":
    case "pending":
    case "analyzing":
      return false
  }
}

export function useComparisonWorkspace(
  dependencies: ComparisonWorkspaceDependencies = DEFAULT_DEPENDENCIES,
  active = true,
  externalBusy = false,
) {
  const lifecycle = useComparisonSession(dependencies)
  const analysis = useComparisonAnalysis(dependencies, lifecycle.runtime)
  const [exportSettings, setExportSettingsState] = useState(() =>
    createComparisonExportSettings(createDefaultSessionName(dependencies.now?.() ?? new Date())),
  )
  const exportSettingsRef = useRef(exportSettings)
  const angleRef = useRef<ComparisonAngle | null>(null)
  const renderModelRef = useRef<ComparisonRenderModel | null>(null)
  const activeRef = useRef(active)
  const externalBusyRef = useRef(externalBusy)
  const privacyRef = useRef<{
    identity: string
    before: EyePrivacyRaster
    after: EyePrivacyRaster
  }>({
    identity: "off:0:0:0",
    before: { enabled: false } as const,
    after: { enabled: false } as const,
  })
  useLayoutEffect(() => {
    activeRef.current = active
    externalBusyRef.current = externalBusy
  }, [active, externalBusy])
  const exportRuntime = useMemo(
    () => ({
      activeRef,
      angleRef,
      renderModelRef,
      exportSettingsRef,
      generationRef: lifecycle.runtime.generationRef,
      mountedRef: lifecycle.runtime.mountedRef,
      sessionRef: lifecycle.runtime.sessionRef,
      privacyRef,
    }),
    [lifecycle.runtime],
  )
  const {
    clearExportStatus,
    exportCount,
    exported,
    exporting,
    exportMessage,
    exportComparison,
    isExporting,
  } = useComparisonExport(dependencies, exportRuntime)
  const alignmentRuntime = useMemo(() => ({ angleRef, renderModelRef }), [])
  const alignment = useComparisonAlignment(lifecycle.session, clearExportStatus, alignmentRuntime)
  const eyePrivacy = useComparisonEyePrivacy({
    active,
    busy: analysis.analysisSide !== null || exporting || externalBusy,
    clearExportStatus,
    isBusy: isExporting,
    generations: lifecycle.runtime.generationRef.current,
    session: lifecycle.session,
  })
  useLayoutEffect(() => {
    privacyRef.current = {
      identity: eyePrivacy.identity,
      before: eyePrivacy.rasterFor("before"),
      after: eyePrivacy.rasterFor("after"),
    }
  }, [eyePrivacy.identity, eyePrivacy.rasterFor])
  const setExportSettings = useCallback(
    (next: ComparisonExportSettings) => {
      exportSettingsRef.current = next
      setExportSettingsState(next)
      clearExportStatus()
    },
    [clearExportStatus],
  )

  const selectFile = useCallback(
    (side: ComparisonSide, file: File) => {
      if (externalBusy) return
      lifecycle.selectFile(side, file)
      if (parseImageFiles([file]).kind !== "rejected") recordUsageEvent("app_use")
      analysis.resetPresentation()
      alignment.invalidateSide(side)
    },
    [alignment.invalidateSide, analysis.resetPresentation, externalBusy, lifecycle.selectFile],
  )
  const removeSide = useCallback(
    (side: ComparisonSide) => {
      if (externalBusy) return
      lifecycle.removeSide(side)
      analysis.resetProgress()
      alignment.invalidateSide(side)
    },
    [alignment.invalidateSide, analysis.resetProgress, externalBusy, lifecycle.removeSide],
  )
  const reset = useCallback(() => {
    if (externalBusy) return
    eyePrivacy.reset()
    lifecycle.reset()
    analysis.resetPresentation()
    alignment.setAngle(null)
    setExportSettings(
      createComparisonExportSettings(createDefaultSessionName(dependencies.now?.() ?? new Date())),
    )
  }, [
    alignment.setAngle,
    analysis.resetPresentation,
    dependencies,
    externalBusy,
    eyePrivacy.reset,
    lifecycle.reset,
    setExportSettings,
  ])
  const applyReferencePair = useCallback(
    (
      pair: { readonly before: ReadyComparisonSlot; readonly after: ReadyComparisonSlot },
      references: ComparisonReferencePair,
      angle: ComparisonAngle,
    ): boolean => {
      const current = lifecycle.runtime.sessionRef.current
      if (
        !active ||
        !activeRef.current ||
        !lifecycle.runtime.mountedRef.current ||
        externalBusy ||
        externalBusyRef.current ||
        current.phase === "analyzing" ||
        isExporting() ||
        !matchesReferenceSource(current.before, pair.before) ||
        !matchesReferenceSource(current.after, pair.after)
      )
        return false
      const proposed = buildComparisonRenderModel({
        angle,
        manualRecovery: true,
        manualReferences: references,
        pair,
        residual: EMPTY_COMPARISON_ADJUSTMENT,
        revision: 0,
      })
      if (proposed.kind !== "ready") return false
      if (current.before.kind === "error") lifecycle.beginManual("before")
      if (current.after.kind === "error") lifecycle.beginManual("after")
      alignment.setReferencePair(references, angle)
      return true
    },
    [
      active,
      alignment.setReferencePair,
      externalBusy,
      isExporting,
      lifecycle.beginManual,
      lifecycle.runtime,
    ],
  )

  return {
    session: lifecycle.session,
    angle: alignment.angle,
    angleOverride: alignment.angleOverride,
    angleResolution: alignment.angleResolution,
    progress: analysis.progress,
    analysisSide: analysis.analysisSide,
    canAnalyze: !externalBusy && canAnalyzeComparisonPending(lifecycle.session),
    canExport:
      alignment.renderModel?.kind === "ready" &&
      eyePrivacy.canExport &&
      !exporting &&
      !externalBusy,
    selectFile,
    analyze: analysis.analyzePending,
    analyzePending: analysis.analyzePending,
    retry: analysis.retry,
    beginManual: lifecycle.beginManual,
    removeSide,
    setAngle: alignment.setAngle,
    exported,
    exportCount,
    exporting,
    exportMessage,
    exportComparison,
    exportSettings,
    setExportSettings,
    renderModel: alignment.renderModel,
    manualReferences: alignment.manualReferences,
    residual: alignment.residual,
    journey: analysis.journey,
    eyePrivacy,
    cancelAnalysis: analysis.cancelAnalysis,
    applyReferencePair,
    setReference: alignment.setReference,
    setReferences: alignment.setReferences,
    resetReferences: alignment.resetReferences,
    setResidual: alignment.setResidual,
    reset,
    exit: reset,
  }
}
