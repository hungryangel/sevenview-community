import { describe, expect, it } from "vitest"

import { createComparisonCrop } from "../src/domain/comparison-crop"
import { projectPointToTarget } from "../src/domain/render-plan"
import { type PhotoPose, photoId } from "../src/domain/types"

const target = { width: 400, height: 500 }

function pose(overrides: Partial<PhotoPose> = {}): PhotoPose {
  return {
    id: photoId("comparison"),
    yawScore: 0,
    pitchScore: 0,
    rollDegrees: 7,
    confidence: 0.95,
    bounds: { left: 0.35, top: 0.4, right: 0.65, bottom: 0.6 },
    anchor: { x: 0.5, y: 0.5 },
    ...overrides,
  }
}

describe("createComparisonCrop", () => {
  it("normalizes roomy sources to the shared 4:5 face and anchor profile", () => {
    const source = { width: 1600, height: 2000 }
    const result = createComparisonCrop({ pose: pose({ rollDegrees: 0 }), source, target })
    const forehead = projectPointToTarget(result.instruction, { x: 800, y: 800 })
    const chin = projectPointToTarget(result.instruction, { x: 800, y: 1200 })

    expect(result.instruction.targetSize).toEqual(target)
    expect(result.instruction.targetAnchor).toEqual({ x: 200, y: 250 })
    expect(result.instruction.rotationDegrees).toBeCloseTo(0, 10)
    expect((chin.y - forehead.y) / target.height).toBeCloseTo(0.52, 10)
    expect(result.achievedFaceRatio).toBeCloseTo(0.52, 10)
    expect(result.sourceLimited).toBe(false)
  })

  it("marks a tight source as limited while keeping every crop value finite", () => {
    const result = createComparisonCrop({
      pose: pose({ bounds: { left: 0.2, top: 0.2, right: 0.8, bottom: 0.8 } }),
      source: { width: 400, height: 500 },
      target,
    })

    expect(result.sourceLimited).toBe(true)
    expect(result.achievedFaceRatio).toBeGreaterThan(0.52)
    expect(Object.values(result.instruction.sourceAnchor).every(Number.isFinite)).toBe(true)
    expect(Object.values(result.instruction.targetAnchor).every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(result.instruction.scale)).toBe(true)
  })

  it("uses a strict greater-than check at the exact 0.1% epsilon boundary", () => {
    const desiredScale = 0.52 / 0.52052
    const result = createComparisonCrop({
      pose: pose({
        rollDegrees: 0,
        bounds: { left: 0.25, top: 0.23974, right: 0.75, bottom: 0.76026 },
      }),
      source: { width: 400, height: 500 },
      target,
    })

    expect(result.instruction.scale / desiredScale).toBeCloseTo(1.001, 12)
    expect(result.sourceLimited).toBe(false)
  })

  it("guards zero-size input without producing non-finite output", () => {
    const result = createComparisonCrop({
      pose: pose({ bounds: { left: 0, top: 0, right: 0, bottom: 0 } }),
      source: { width: 0, height: 0 },
      target: { width: 0, height: 0 },
    })

    expect(Number.isFinite(result.instruction.scale)).toBe(true)
    expect(Number.isFinite(result.achievedFaceRatio)).toBe(true)
  })
})
