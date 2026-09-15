import type { ComparisonSlot } from "../domain/comparison-session"
import type { PhotoBatchItem } from "../services/analyze-batch"

type ComparisonResourceDependencies = {
  readonly releaseImage: (image: CanvasImageSource) => void
  readonly releasePreviewUrl: (previewUrl: string) => void
}

export function releaseComparisonSlot(
  slot: ComparisonSlot<CanvasImageSource>,
  dependencies: ComparisonResourceDependencies,
): void {
  switch (slot.kind) {
    case "empty":
      return
    case "pending":
    case "analyzing":
      dependencies.releasePreviewUrl(slot.previewUrl)
      return
    case "error":
      dependencies.releasePreviewUrl(slot.previewUrl)
      if (slot.decoded !== undefined) dependencies.releaseImage(slot.decoded.image)
      return
    case "ready":
    case "manual":
      dependencies.releaseImage(slot.decoded.image)
      return
  }
}

export function releaseComparisonBatchResults(
  results: readonly PhotoBatchItem<CanvasImageSource>[],
  dependencies: ComparisonResourceDependencies,
): void {
  for (const result of results) {
    if (result.kind === "ready") {
      dependencies.releaseImage(result.decoded.image)
    } else if (result.decoded !== null) {
      dependencies.releaseImage(result.decoded.image)
    }
  }
}
