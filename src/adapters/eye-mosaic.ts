import { type EyePrivacyMask, isUsableEyePrivacyMask } from "../domain/comparison-eye-privacy"
import { EXPORT_RENDER_STYLE } from "../domain/export-render-style"
import { buildRenderPlan } from "../domain/render-plan"
import type { CropInstruction, ImageSize, Rect } from "../domain/types"
import type { DrawingContext } from "./canvas"

export type EyeMosaicContext<TImage> = {
  imageSmoothingEnabled?: boolean
  drawImage(image: TImage, ...coordinates: number[]): void
}

export type EyePrivacyDrawingContext<TImage> = DrawingContext<TImage> & EyeMosaicContext<TImage>

export class EyePrivacyRasterError extends Error {
  readonly name = "EyePrivacyRasterError"
}

function assertSourceSize(size: ImageSize): void {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  )
    throw new EyePrivacyRasterError("Eye mask source is invalid")
}

function drawRegion<TImage>(
  context: EyeMosaicContext<TImage>,
  image: TImage,
  size: ImageSize,
  region: Rect,
): void {
  const left = region.left * size.width
  const top = region.top * size.height
  const width = (region.right - region.left) * size.width
  const height = (region.bottom - region.top) * size.height
  const columns = Math.max(6, Math.min(18, Math.round(width / 24)))
  const rows = Math.max(3, Math.min(9, Math.round(height / 24)))
  const cellWidth = width / columns
  const cellHeight = height / rows
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = left + column * cellWidth
      const y = top + row * cellHeight
      const sampleX = Math.min(size.width - 1, Math.max(0, Math.round(x + cellWidth / 2)))
      const sampleY = Math.min(size.height - 1, Math.max(0, Math.round(y + cellHeight / 2)))
      context.drawImage(image, sampleX, sampleY, 1, 1, x, y, cellWidth + 0.5, cellHeight + 0.5)
    }
  }
}

export function drawEyeMosaicInSource<TImage>(
  context: EyeMosaicContext<TImage>,
  image: TImage,
  sourceSize: ImageSize,
  mask: EyePrivacyMask,
): void {
  if (!isUsableEyePrivacyMask(mask)) throw new EyePrivacyRasterError("Eye mask review is required")
  assertSourceSize(sourceSize)
  const previousSmoothing = context.imageSmoothingEnabled
  context.imageSmoothingEnabled = false
  try {
    for (const region of mask.regions) drawRegion(context, image, sourceSize, region)
  } finally {
    if (previousSmoothing !== undefined) context.imageSmoothingEnabled = previousSmoothing
  }
}

export function drawPrivacyCroppedImage<TImage>(
  context: EyePrivacyDrawingContext<TImage>,
  image: TImage,
  crop: CropInstruction,
  privacy: import("../domain/comparison-eye-privacy").EyePrivacyRaster,
): void {
  const plan = buildRenderPlan(crop)
  context.save()
  context.fillStyle = EXPORT_RENDER_STYLE.background
  context.fillRect(0, 0, plan.targetSize.width, plan.targetSize.height)
  context.translate(plan.translateTo.x, plan.translateTo.y)
  context.rotate(plan.rotationRadians)
  context.scale(plan.scale, plan.scale)
  context.translate(plan.translateSource.x, plan.translateSource.y)
  context.drawImage(image, 0, 0)
  if (privacy.enabled) {
    if (privacy.mask === null) throw new EyePrivacyRasterError("Eye mask review is required")
    drawEyeMosaicInSource(context, image, privacy.sourceSize, privacy.mask)
  }
  context.restore()
}

export function drawEyeMosaicInFrame<TImage>(
  context: EyeMosaicContext<TImage>,
  image: TImage,
  sourceSize: ImageSize,
  frame: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  },
  mask: EyePrivacyMask,
): void {
  if (!isUsableEyePrivacyMask(mask)) throw new EyePrivacyRasterError("Eye mask review is required")
  assertSourceSize(sourceSize)
  const previousSmoothing = context.imageSmoothingEnabled
  context.imageSmoothingEnabled = false
  try {
    for (const region of mask.regions) {
      const sourceLeft = region.left * sourceSize.width
      const sourceTop = region.top * sourceSize.height
      const sourceWidth = (region.right - region.left) * sourceSize.width
      const sourceHeight = (region.bottom - region.top) * sourceSize.height
      const columns = Math.max(6, Math.min(18, Math.round(sourceWidth / 24)))
      const rows = Math.max(3, Math.min(9, Math.round(sourceHeight / 24)))
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const sourceX = sourceLeft + (column * sourceWidth) / columns
          const sourceY = sourceTop + (row * sourceHeight) / rows
          const sampleX = Math.min(
            sourceSize.width - 1,
            Math.max(0, Math.round(sourceX + sourceWidth / columns / 2)),
          )
          const sampleY = Math.min(
            sourceSize.height - 1,
            Math.max(0, Math.round(sourceY + sourceHeight / rows / 2)),
          )
          const targetX =
            frame.x +
            region.left * frame.width +
            (column * (region.right - region.left) * frame.width) / columns
          const targetY =
            frame.y +
            region.top * frame.height +
            (row * (region.bottom - region.top) * frame.height) / rows
          context.drawImage(
            image,
            sampleX,
            sampleY,
            1,
            1,
            targetX,
            targetY,
            ((region.right - region.left) * frame.width) / columns + 0.5,
            ((region.bottom - region.top) * frame.height) / rows + 0.5,
          )
        }
      }
    }
  } finally {
    if (previousSmoothing !== undefined) context.imageSmoothingEnabled = previousSmoothing
  }
}
