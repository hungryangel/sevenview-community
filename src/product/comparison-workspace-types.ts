import type { RefObject } from "react"

import type { ComparisonExportPair } from "../adapters/comparison-canvas"
import type { ComparisonSide } from "../domain/comparison"
import type { ComparisonExportSettings } from "../domain/comparison-export"
import type { ComparisonSession, ComparisonSessionAction } from "../domain/comparison-session"
import type { AnalysisStageEvent, PhotoBatchItem } from "../services/analyze-batch"

export type ComparisonWorkspaceDependencies = {
  readonly analyzeFiles: (
    files: readonly File[],
    onProgress?: (processed: number, total: number) => void,
    runtimeOptions?: {
      readonly onStage?: (event: AnalysisStageEvent<CanvasImageSource>) => void
      readonly signal?: AbortSignal
    },
  ) => Promise<readonly PhotoBatchItem<CanvasImageSource>[]>
  readonly createPreviewUrl: (file: File) => string
  readonly releaseImage: (image: CanvasImageSource) => void
  readonly releasePreviewUrl: (previewUrl: string) => void
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

export type ComparisonSessionRuntime = {
  readonly sessionRef: RefObject<ComparisonSession<CanvasImageSource>>
  readonly generationRef: RefObject<Record<ComparisonSide, number>>
  readonly mountedRef: RefObject<boolean>
  readonly analysisControllerRef: RefObject<AbortController | null>
  readonly transition: (action: ComparisonSessionAction<CanvasImageSource>) => void
}
