import { describe, expect, it } from "vitest"
import { relativeCropMatrix } from "../src/domain/analysis-presentation-geometry"
import type { CropInstruction, Point } from "../src/domain/types"

function project(point: Point, crop: CropInstruction): Point {
  const radians = crop.rotationDegrees * (Math.PI / 180)
  const x = point.x - crop.sourceAnchor.x
  const y = point.y - crop.sourceAnchor.y
  return {
    x: crop.targetAnchor.x + crop.scale * (Math.cos(radians) * x - Math.sin(radians) * y),
    y: crop.targetAnchor.y + crop.scale * (Math.sin(radians) * x + Math.cos(radians) * y),
  }
}

describe("relativeCropMatrix", () => {
  it("maps a point in the contained canvas to the same actual final projection", () => {
    const source: CropInstruction = {
      sourceAnchor: { x: 500, y: 400 },
      targetAnchor: { x: 200, y: 250 },
      targetSize: { width: 400, height: 500 },
      scale: 0.4,
      rotationDegrees: 0,
    }
    const target: CropInstruction = {
      sourceAnchor: { x: 470, y: 360 },
      targetAnchor: { x: 205, y: 210 },
      targetSize: { width: 400, height: 500 },
      scale: 0.7,
      rotationDegrees: 8,
    }
    const point = { x: 610, y: 510 }
    const contained = project(point, source)
    const expected = project(point, target)
    const [a, b, c, d, x, y] = relativeCropMatrix(source, target)
    expect({
      x: a * contained.x + c * contained.y + x,
      y: b * contained.x + d * contained.y + y,
    }).toEqual({ x: expect.closeTo(expected.x, 8), y: expect.closeTo(expected.y, 8) })
  })
})
