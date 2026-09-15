import { projectPointToTarget } from "./render-plan"
import type { CropInstruction, ImageSize, Point } from "./types"

export function projectionError(
  instruction: CropInstruction,
  source: Point,
  target: Point,
): number {
  const projected = projectPointToTarget(instruction, source)
  return Math.hypot(projected.x - target.x, projected.y - target.y)
}

export function instructionLeavesNeutralMargin(
  instruction: CropInstruction,
  source: ImageSize,
): boolean {
  const radians = (-instruction.rotationDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const corners = [
    { x: 0, y: 0 },
    { x: instruction.targetSize.width, y: 0 },
    { x: 0, y: instruction.targetSize.height },
    { x: instruction.targetSize.width, y: instruction.targetSize.height },
  ]
  return corners.some((corner) => {
    const dx = (corner.x - instruction.targetAnchor.x) / instruction.scale
    const dy = (corner.y - instruction.targetAnchor.y) / instruction.scale
    const x = cos * dx - sin * dy + instruction.sourceAnchor.x
    const y = sin * dx + cos * dy + instruction.sourceAnchor.y
    return x < 0 || x > source.width || y < 0 || y > source.height
  })
}
