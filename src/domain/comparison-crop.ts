import { createProfileCrop } from "./crop"
import type { CropInstruction, ImageSize, PhotoPose } from "./types"

const COMPARISON_PROFILE = {
  faceExtent: "height",
  faceRatio: 0.52,
  targetAnchor: { x: 0.5, y: 0.5 },
} as const

const SOURCE_LIMIT_RELATIVE_EPSILON = 0.001

export type ComparisonCropInput = {
  readonly pose: PhotoPose
  readonly source: ImageSize
  readonly target: ImageSize
}

export type ComparisonCropResult = {
  readonly achievedFaceRatio: number
  readonly instruction: CropInstruction
  readonly sourceLimited: boolean
}

export function createComparisonCrop(input: ComparisonCropInput): ComparisonCropResult {
  const crop = createProfileCrop({ ...input, profile: COMPARISON_PROFILE })
  const faceHeightPixels =
    Math.abs(input.pose.bounds.bottom - input.pose.bounds.top) * input.source.height
  const targetHeight = Math.max(1, input.target.height)
  const relativeCoverExcess =
    crop.desiredFaceScale === 0 ? 0 : crop.coverScale / crop.desiredFaceScale - 1

  return {
    achievedFaceRatio: (faceHeightPixels * crop.instruction.scale) / targetHeight,
    instruction: crop.instruction,
    sourceLimited: relativeCoverExcess > SOURCE_LIMIT_RELATIVE_EPSILON + Number.EPSILON * 8,
  }
}
