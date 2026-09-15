import { vi } from "vitest"

import { type FaceMetrics, photoId } from "../../src/domain/types"
import type { ComparisonWorkspaceDependencies } from "../../src/product/use-comparison-workspace"
import type { PhotoBatchItem } from "../../src/services/analyze-batch"

const metrics: FaceMetrics = {
  yawScore: 0,
  pitchScore: 0,
  rollDegrees: 0,
  confidence: 0.9,
  bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
  anchor: { x: 0.5, y: 0.5 },
  registrationAnchors: {
    noseTip: { x: 0.5, y: 0.48 },
    screenLeftEye: { x: 0.38, y: 0.4 },
    screenRightEye: { x: 0.62, y: 0.4 },
  },
}

export function source(name: string): File {
  return new File([name], `${name}.jpg`, { type: "image/jpeg" })
}

export function ready(
  file: File,
  image: CanvasImageSource,
  index: number,
): PhotoBatchItem<CanvasImageSource> {
  return {
    kind: "ready",
    file,
    decoded: { image, width: 800, height: 1000 },
    pose: { ...metrics, id: photoId(`photo-${index}`) },
  }
}

export function dependencies(analyzeFiles: ComparisonWorkspaceDependencies["analyzeFiles"]) {
  let urlIndex = 0
  return {
    analyzeFiles,
    createPreviewUrl: vi.fn(() => `blob:${++urlIndex}`),
    releaseImage: vi.fn(),
    releasePreviewUrl: vi.fn(),
  } satisfies ComparisonWorkspaceDependencies
}
