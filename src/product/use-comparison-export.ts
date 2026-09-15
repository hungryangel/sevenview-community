import type { RefObject } from "react"
import { useCallback, useRef, useState } from "react"

import type { ComparisonExportPair } from "../adapters/comparison-canvas"
import { exportBrowserComparison } from "../adapters/comparison-export"
import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import {
  type ComparisonExportSettings,
  createComparisonExportSettings,
  hasComparisonExportOutput,
} from "../domain/comparison-export"
import type { EyePrivacyRaster } from "../domain/comparison-eye-privacy"
import { type ComparisonSession, isRenderableComparisonSlot } from "../domain/comparison-session"
import { createDefaultSessionName } from "../domain/session-export"
import { type ComparisonRenderModel, scaleComparisonInstruction } from "./comparison-render-model"

type ComparisonExportDependencies = {
  readonly exportPng?: (
    pair: ComparisonExportPair<CanvasImageSource>,
    now: Date | undefined,
    shouldDownload: () => boolean,
  ) => Promise<"downloaded" | "stale">
  readonly exportFiles?: (
    pair: ComparisonExportPair<CanvasImageSource>,
    settings: ComparisonExportSettings,
    shouldDownload: () => boolean,
  ) => Promise<"downloaded" | "stale">
  readonly now?: () => Date
}

type ComparisonExportRuntime = {
  readonly activeRef: RefObject<boolean>
  readonly angleRef: RefObject<ComparisonAngle | null>
  readonly exportSettingsRef?: RefObject<ComparisonExportSettings>
  readonly generationRef: RefObject<Record<ComparisonSide, number>>
  readonly mountedRef: RefObject<boolean>
  readonly renderModelRef: RefObject<ComparisonRenderModel | null>
  readonly sessionRef: RefObject<ComparisonSession<CanvasImageSource>>
  readonly privacyRef: RefObject<{
    readonly identity: string
    readonly before: EyePrivacyRaster
    readonly after: EyePrivacyRaster
  }>
}

export function useComparisonExport(
  dependencies: ComparisonExportDependencies,
  runtime: ComparisonExportRuntime,
) {
  const [exported, setExported] = useState(false)
  const [exportCount, setExportCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const exportInFlightRef = useRef(false)

  const clearExportStatus = useCallback(() => {
    setExported(false)
    setExportMessage(null)
  }, [])
  const isExporting = useCallback(() => exportInFlightRef.current, [])

  const exportComparison = useCallback(async () => {
    if (exportInFlightRef.current) {
      return
    }
    const current = runtime.sessionRef.current
    const model = runtime.renderModelRef.current
    const settings =
      runtime.exportSettingsRef?.current ??
      createComparisonExportSettings(createDefaultSessionName(dependencies.now?.() ?? new Date()))
    if (
      !isRenderableComparisonSlot(current.before) ||
      !isRenderableComparisonSlot(current.after) ||
      model === null ||
      model.kind !== "ready" ||
      !hasComparisonExportOutput(settings.selection)
    ) {
      return
    }
    const privacy = runtime.privacyRef.current
    if (
      (privacy.before.enabled && privacy.before.mask === null) ||
      (privacy.after.enabled && privacy.after.mask === null)
    ) {
      setExportMessage("눈 모자이크 범위를 확인해 주세요.")
      return
    }
    exportInFlightRef.current = true
    setExporting(true)
    setExportMessage(null)
    const snapshot = {
      angle: runtime.angleRef.current,
      afterGeneration: runtime.generationRef.current.after,
      afterImage: current.after.decoded.image,
      beforeGeneration: runtime.generationRef.current.before,
      beforeImage: current.before.decoded.image,
      revision: model.revision,
      privacyIdentity: privacy.identity,
      settings,
    }
    const pair: ComparisonExportPair<CanvasImageSource> = {
      before: {
        image: current.before.decoded.image,
        instruction: scaleComparisonInstruction(model.before.instruction, {
          height: 940,
          width: 752,
        }),
        privacy: privacy.before,
      },
      after: {
        image: current.after.decoded.image,
        instruction: scaleComparisonInstruction(model.after.instruction, {
          height: 940,
          width: 752,
        }),
        privacy: privacy.after,
      },
    }
    const isCurrent = () => {
      const latest = runtime.sessionRef.current
      return (
        runtime.mountedRef.current &&
        runtime.activeRef.current &&
        runtime.generationRef.current.before === snapshot.beforeGeneration &&
        runtime.generationRef.current.after === snapshot.afterGeneration &&
        runtime.angleRef.current === snapshot.angle &&
        (runtime.exportSettingsRef === undefined ||
          runtime.exportSettingsRef.current === snapshot.settings) &&
        isRenderableComparisonSlot(latest.before) &&
        isRenderableComparisonSlot(latest.after) &&
        runtime.renderModelRef.current?.revision === snapshot.revision &&
        runtime.privacyRef.current.identity === snapshot.privacyIdentity &&
        latest.before.decoded.image === snapshot.beforeImage &&
        latest.after.decoded.image === snapshot.afterImage
      )
    }
    try {
      let outcome: "downloaded" | "stale"
      if (dependencies.exportPng !== undefined && dependencies.exportFiles === undefined) {
        outcome = await dependencies.exportPng(pair, dependencies.now?.(), isCurrent)
      } else {
        outcome = await (dependencies.exportFiles ?? exportBrowserComparison)(
          pair,
          settings,
          isCurrent,
        )
      }
      if (outcome === "stale") return
      if (runtime.mountedRef.current) setExportCount((count) => count + 1)
      if (isCurrent()) {
        setExported(true)
        if (runtime.activeRef.current && document.visibilityState === "visible") {
          setExportMessage("비교 이미지를 저장했습니다")
        }
      }
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        throw error
      }
      if (isCurrent()) {
        setExportMessage("저장하지 못했습니다. 사진은 유지됩니다. 다시 시도해 주세요.")
      }
    } finally {
      exportInFlightRef.current = false
      if (runtime.mountedRef.current) {
        setExporting(false)
      }
    }
  }, [dependencies, runtime])

  return {
    clearExportStatus,
    isExporting,
    exportCount,
    exported,
    exporting,
    exportMessage,
    exportComparison,
  }
}
