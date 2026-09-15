import { projectPointToTarget } from "./render-plan"
import type { CropInstruction, Point } from "./types"

export const CROP_CONTEXT_BAND = 24

export function inverseCropPolygon(crop: CropInstruction): readonly Point[] {
  const radians = (-crop.rotationDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return [
    { x: 0, y: 0 },
    { x: crop.targetSize.width, y: 0 },
    { x: crop.targetSize.width, y: crop.targetSize.height },
    { x: 0, y: crop.targetSize.height },
  ].map((point) => {
    const dx = (point.x - crop.targetAnchor.x) / crop.scale
    const dy = (point.y - crop.targetAnchor.y) / crop.scale
    return {
      x: cos * dx - sin * dy + crop.sourceAnchor.x,
      y: sin * dx + cos * dy + crop.sourceAnchor.y,
    }
  })
}

export function buildCropContextGeometry(crop: CropInstruction) {
  const sourcePolygon = inverseCropPolygon(crop)
  const contextInstruction: CropInstruction = {
    ...crop,
    targetAnchor: {
      x: crop.targetAnchor.x + CROP_CONTEXT_BAND,
      y: crop.targetAnchor.y + CROP_CONTEXT_BAND,
    },
    targetSize: {
      height: crop.targetSize.height + CROP_CONTEXT_BAND * 2,
      width: crop.targetSize.width + CROP_CONTEXT_BAND * 2,
    },
  }
  return {
    boundary: sourcePolygon.map((point) => projectPointToTarget(contextInstruction, point)),
    contextInstruction,
    sourcePolygon,
  }
}
