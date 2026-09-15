import { describe, expect, it } from "vitest"

import { buildRenderPlan, projectPointToTarget } from "../src/domain/render-plan"

describe("buildRenderPlan", () => {
  it("orders translation, rotation, scale, and source anchoring for canvas rendering", () => {
    // Given: a crop instruction aligned around a source face anchor.
    const crop = {
      sourceAnchor: { x: 420, y: 520 },
      targetAnchor: { x: 200, y: 240 },
      targetSize: { width: 400, height: 500 },
      scale: 0.5,
      rotationDegrees: -6,
    }

    // When: a canvas render plan is built.
    const result = buildRenderPlan(crop)

    // Then: the pure plan preserves the exact transform sequence.
    expect(result).toEqual({
      targetSize: { width: 400, height: 500 },
      translateTo: { x: 200, y: 240 },
      rotationRadians: (-6 * Math.PI) / 180,
      scale: 0.5,
      translateSource: { x: -420, y: -520 },
    })
  })
})

describe("projectPointToTarget", () => {
  it("maps the source anchor onto the target anchor regardless of rotation", () => {
    const crop = {
      sourceAnchor: { x: 400, y: 500 },
      targetAnchor: { x: 200, y: 240 },
      targetSize: { width: 400, height: 500 },
      scale: 0.5,
      rotationDegrees: 33,
    }

    expect(projectPointToTarget(crop, { x: 400, y: 500 })).toEqual({ x: 200, y: 240 })
  })

  it("matches the canvas transform order (rotate, then scale, from the anchor)", () => {
    const crop = {
      sourceAnchor: { x: 100, y: 100 },
      targetAnchor: { x: 50, y: 50 },
      targetSize: { width: 100, height: 100 },
      scale: 2,
      rotationDegrees: 90,
    }

    // (110,100)은 앵커에서 +x로 10px — 90° 회전·2배 후 target에서는 +y로 20px.
    const projected = projectPointToTarget(crop, { x: 110, y: 100 })
    expect(projected.x).toBeCloseTo(50, 6)
    expect(projected.y).toBeCloseTo(70, 6)
  })
})
