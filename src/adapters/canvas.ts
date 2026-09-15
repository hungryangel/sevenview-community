import { EXPORT_RENDER_STYLE } from "../domain/export-render-style"
import { buildRenderPlan } from "../domain/render-plan"
import type { CropInstruction } from "../domain/types"

export type DrawingContext<TImage> = {
  fillStyle: string | CanvasGradient | CanvasPattern
  drawImage(image: TImage, ...coordinates: number[]): void
  fillRect(x: number, y: number, width: number, height: number): void
  restore(): void
  rotate(radians: number): void
  save(): void
  scale(x: number, y: number): void
  translate(x: number, y: number): void
}

export function drawCroppedImage<TImage>(
  context: DrawingContext<TImage>,
  image: TImage,
  crop: CropInstruction,
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
  context.restore()
}
