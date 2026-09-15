import type { AnalysisFailureCode, FaceMetrics, PhotoPose } from "../domain/types"
import { photoId } from "../domain/types"
import { throwIfAborted, yieldToBrowser } from "./browser-yield"

export type { AnalysisFailureCode } from "../domain/types"

export type DecodedPhoto<TImage> = {
  readonly image: TImage
  readonly width: number
  readonly height: number
}

export type PhotoBatchItem<TImage> =
  | {
      readonly kind: "ready"
      readonly file: File
      readonly decoded: DecodedPhoto<TImage>
      readonly pose: PhotoPose
    }
  | {
      readonly kind: "error"
      readonly file: File
      readonly code: AnalysisFailureCode
      readonly decoded: DecodedPhoto<TImage> | null
    }

export type AnalysisStageEvent<TImage> =
  | { readonly kind: "decoded"; readonly index: number; readonly decoded: DecodedPhoto<TImage> }
  | { readonly kind: "analyzed"; readonly index: number; readonly item: PhotoBatchItem<TImage> }

type AnalyzeBatchOptions<TImage> = {
  readonly analyze: (image: TImage, signal?: AbortSignal) => FaceMetrics | Promise<FaceMetrics>
  readonly classifyError: (error: unknown) => AnalysisFailureCode
  readonly decode: (file: File) => Promise<DecodedPhoto<TImage>>
  readonly discardDecoded?: (decoded: DecodedPhoto<TImage>) => void
  readonly onProgress?: (processed: number, total: number) => void
  readonly onStage?: (event: AnalysisStageEvent<TImage>) => void
  readonly signal?: AbortSignal
  readonly yieldControl?: (signal?: AbortSignal) => Promise<void>
}

class StageObserverError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super("Analysis stage observer failed")
    this.cause = cause
  }
}

export async function analyzePhotoBatch<TImage>(
  files: readonly File[],
  options: AnalyzeBatchOptions<TImage>,
): Promise<readonly PhotoBatchItem<TImage>[]> {
  const results: PhotoBatchItem<TImage>[] = []
  const ownedDecoded = new Set<DecodedPhoto<TImage>>()
  const yieldControl = options.yieldControl ?? yieldToBrowser
  const emitStage = (event: AnalysisStageEvent<TImage>) => {
    try {
      options.onStage?.(event)
    } catch (error: unknown) {
      throw new StageObserverError(error)
    }
  }

  const discardRun = () => {
    if (options.discardDecoded === undefined) return
    for (const item of ownedDecoded) options.discardDecoded(item)
    ownedDecoded.clear()
  }

  try {
    for (const [index, file] of files.entries()) {
      let decoded: DecodedPhoto<TImage> | null = null

      try {
        throwIfAborted(options.signal)
        decoded = await options.decode(file)
        ownedDecoded.add(decoded)
        throwIfAborted(options.signal)
        emitStage({ kind: "decoded", index, decoded })
        throwIfAborted(options.signal)
        const metrics = await options.analyze(decoded.image, options.signal)
        throwIfAborted(options.signal)
        const pose: PhotoPose = { ...metrics, id: photoId(`photo-${index + 1}`) }
        const item = { kind: "ready", file, decoded, pose } as const
        emitStage({ kind: "analyzed", index, item })
        throwIfAborted(options.signal)
        results.push(item)
      } catch (error: unknown) {
        if (error instanceof StageObserverError) throw error
        if (
          options.signal?.aborted === true ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          throw error
        }
        const item = {
          kind: "error",
          file,
          decoded,
          code: options.classifyError(error),
        } as const
        emitStage({ kind: "analyzed", index, item })
        results.push(item)
      }

      options.onProgress?.(index + 1, files.length)
      if (index < files.length - 1) {
        await yieldControl(options.signal)
        throwIfAborted(options.signal)
      }
    }
    throwIfAborted(options.signal)
  } catch (error: unknown) {
    discardRun()
    throw error instanceof StageObserverError ? error.cause : error
  }

  return results
}
