import { classifyPhotoError, decodeImageFile } from "../adapters/browser-image"
import { releaseImage } from "../adapters/image-resource"
import type { AnalysisFailureCode, FaceMetrics } from "../domain/types"
import {
  type AnalysisStageEvent,
  analyzePhotoBatch,
  type DecodedPhoto,
  type PhotoBatchItem,
} from "./analyze-batch"
import { throwIfAborted } from "./browser-yield"

export type AnalyzeLocalFilesOptions<TImage> = {
  readonly createAnalyzer: () => Promise<{
    readonly analyze: (image: TImage, signal?: AbortSignal) => FaceMetrics | Promise<FaceMetrics>
    readonly close: () => void
  }>
  readonly decode: (file: File) => Promise<DecodedPhoto<TImage>>
  readonly classifyError: (error: unknown) => AnalysisFailureCode
  readonly discardDecoded?: (decoded: DecodedPhoto<TImage>) => void
  readonly onProgress?: (processed: number, total: number) => void
  readonly onStage?: (event: AnalysisStageEvent<TImage>) => void
  readonly signal?: AbortSignal
  readonly yieldControl?: (signal?: AbortSignal) => Promise<void>
}

async function createLocalAnalyzer() {
  const { createMediaPipeFaceAnalyzer } = await import("../adapters/mediapipe")
  return createMediaPipeFaceAnalyzer()
}

export async function analyzeLocalFiles<TImage>(
  files: readonly File[],
  options: AnalyzeLocalFilesOptions<TImage>,
): Promise<readonly PhotoBatchItem<TImage>[]> {
  throwIfAborted(options.signal)
  const analyzer = await options.createAnalyzer()
  try {
    throwIfAborted(options.signal)
    return await analyzePhotoBatch(files, {
      analyze: (image, signal) => analyzer.analyze(image, signal),
      classifyError: options.classifyError,
      decode: options.decode,
      ...(options.discardDecoded === undefined ? {} : { discardDecoded: options.discardDecoded }),
      ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
      ...(options.onStage === undefined ? {} : { onStage: options.onStage }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.yieldControl === undefined ? {} : { yieldControl: options.yieldControl }),
    })
  } finally {
    analyzer.close()
  }
}

export function analyzeBrowserFiles(
  files: readonly File[],
  onProgress?: (processed: number, total: number) => void,
  runtimeOptions: Pick<
    AnalyzeLocalFilesOptions<ImageBitmap>,
    "discardDecoded" | "onStage" | "signal" | "yieldControl"
  > = {},
): Promise<readonly PhotoBatchItem<ImageBitmap>[]> {
  return analyzeLocalFiles(files, {
    createAnalyzer: createLocalAnalyzer,
    decode: decodeImageFile,
    classifyError: classifyPhotoError,
    discardDecoded: (decoded) => releaseImage(decoded.image),
    ...(onProgress === undefined ? {} : { onProgress }),
    ...runtimeOptions,
  })
}
