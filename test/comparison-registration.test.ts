import { describe, expect, it } from "vitest"

import {
  instructionLeavesNeutralMargin,
  solveComparisonRegistration,
} from "../src/domain/comparison-registration"
import { projectPointToTarget } from "../src/domain/render-plan"
import { type PhotoPose, photoId } from "../src/domain/types"

const target = { width: 400, height: 500 } as const

function pose(id: string, anchors?: PhotoPose["registrationAnchors"]): PhotoPose {
  return {
    id: photoId(id),
    yawScore: 0,
    pitchScore: 0,
    rollDegrees: 0,
    confidence: 0.9,
    bounds: { left: 0.2, top: 0.15, right: 0.8, bottom: 0.9 },
    anchor: { x: 0.5, y: 0.5 },
    ...(anchors === undefined ? {} : { registrationAnchors: anchors }),
  }
}

const anchors = {
  screenLeftEye: { x: 0.3, y: 0.4 },
  screenRightEye: { x: 0.7, y: 0.4 },
  noseTip: { x: 0.62, y: 0.58 },
} as const

describe("solveComparisonRegistration", () => {
  it.each(["front", "rightOblique", "leftOblique", "rightProfile", "leftProfile"] as const)(
    "projects %s references onto the shared target pair",
    (angle) => {
      const result = solveComparisonRegistration({
        angle,
        before: { pose: pose("before", anchors), source: { width: 1000, height: 1200 } },
        after: { pose: pose("after", anchors), source: { width: 800, height: 1000 } },
        target,
      })
      expect(result.kind).toBe("ready")
      if (result.kind !== "ready") return
      for (const side of [result.before, result.after]) {
        const first = projectPointToTarget(side.instruction, side.sourceReferences.first)
        const second = projectPointToTarget(side.instruction, side.sourceReferences.second)
        expect(
          Math.hypot(
            first.x - side.targetReferences.first.x,
            first.y - side.targetReferences.first.y,
          ),
        ).toBeLessThanOrEqual(0.5)
        expect(
          Math.hypot(
            second.x - side.targetReferences.second.x,
            second.y - side.targetReferences.second.y,
          ),
        ).toBeLessThanOrEqual(0.5)
        expect(side.instruction.scale).toBeGreaterThan(0)
      }
    },
  )

  it.each([
    ["missing_landmarks", pose("missing")],
    ["non_finite_reference", pose("nan", { ...anchors, noseTip: { x: Number.NaN, y: 0.5 } })],
    ["non_finite_reference", pose("range", { ...anchors, noseTip: { x: 1.1, y: 0.5 } })],
    [
      "coincident_reference",
      pose("near", {
        ...anchors,
        noseTip: { x: 0.50001, y: 0.40001 },
        screenLeftEye: { x: 0.4, y: 0.4 },
        screenRightEye: { x: 0.6, y: 0.4 },
      }),
    ],
  ] as const)("returns %s without instructions", (reason, invalidPose) => {
    const result = solveComparisonRegistration({
      angle: "rightProfile",
      before: { pose: invalidPose, source: target },
      after: { pose: pose("ok", anchors), source: target },
      target,
    })
    expect(result).toEqual({ kind: "reviewRequired", reason, side: "before" })
  })

  it("keeps the source immutable and reports neutral margin without cover scaling", () => {
    const before = { pose: pose("before", anchors), source: { width: 120, height: 150 } } as const
    const snapshot = structuredClone(before)
    const result = solveComparisonRegistration({ angle: "front", before, after: before, target })
    expect(before).toEqual(snapshot)
    expect(result.kind).toBe("ready")
    if (result.kind === "ready") expect(result.before.neutralMargin).toBe(true)
  })

  it.each(["rightOblique", "leftOblique", "rightProfile", "leftProfile"] as const)(
    "preserves actual eye-center to nose direction when the category is %s",
    (angle) => {
      // Given an actual rightward nose vector, including a conflicting left category.
      // When registration uses the selected category.
      const result = solveComparisonRegistration({
        angle,
        before: { pose: pose("a", anchors), source: target },
        after: { pose: pose("b", anchors), source: target },
        target,
      })
      // Then direction and orientation come from BEFORE, with no category-driven mirroring.
      expect(result.kind).toBe("ready")
      if (result.kind !== "ready") return
      expect(result.before.targetReferences).toEqual(result.before.sourceReferences)
      expect(result.before.instruction.rotationDegrees).toBe(0)
      expect(result.before.sourceReferences.first).toEqual({ x: 200, y: 200 })
    },
  )

  it.each([
    { width: 400, height: 500 },
    { width: 752, height: 940 },
    { width: 800, height: 1000 },
  ] as const)("preserves normalized canonical content at $width×$height", (resolution) => {
    const result = solveComparisonRegistration({
      angle: "front",
      before: { pose: pose("a", anchors), source: { width: 1200, height: 900 } },
      after: { pose: pose("b", anchors), source: { width: 600, height: 450 } },
      target: resolution,
    })
    expect(result.kind).toBe("ready")
    if (result.kind === "ready") {
      expect(result.before.targetReferences.first.x / resolution.width).toBeCloseTo(0.35, 10)
      expect(result.after.targetReferences.second.x / resolution.width).toBeCloseTo(0.65, 10)
      expect(result.before.targetReferences.first.y / resolution.height).toBeCloseTo(0.4, 10)
    }
  })

  it("records manual reference provenance", () => {
    const manual = { first: { x: 0.2, y: 0.3 }, second: { x: 0.8, y: 0.35 } } as const
    const result = solveComparisonRegistration({
      angle: "front",
      before: { pose: pose("a"), source: target, references: manual },
      after: { pose: pose("b", anchors), source: target },
      target,
    })
    expect(result.kind).toBe("ready")
    if (result.kind === "ready") expect(result.before.provenance).toBe("manual")
  })

  it.each(["before", "after"] as const)(
    "requires corresponding manual points on both sides when %s detection failed",
    (failedSide) => {
      const references = { first: { x: 0.5, y: 0.3 }, second: { x: 0.7, y: 0.6 } }
      const detected = { pose: pose("detected", anchors), source: target }
      const manual = { pose: null, source: target, references }
      const result = solveComparisonRegistration({
        angle: "rightProfile",
        before: failedSide === "before" ? manual : detected,
        after: failedSide === "after" ? manual : detected,
        target,
      })
      expect(result).toEqual({
        kind: "reviewRequired",
        reason: "missing_landmarks",
        side: failedSide === "before" ? "after" : "before",
      })
    },
  )

  it("rejects invalid decoded or target dimensions before division", () => {
    const result = solveComparisonRegistration({
      angle: "front",
      before: { pose: pose("a", anchors), source: { width: 0, height: 500 } },
      after: { pose: pose("b", anchors), source: target },
      target,
    })
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "non_finite_reference",
      side: "before",
    })
  })

  it("reports an invalid after side on that side", () => {
    const result = solveComparisonRegistration({
      angle: "front",
      before: { pose: pose("a", anchors), source: target },
      after: { pose: pose("b"), source: target },
      target,
    })
    expect(result).toEqual({ kind: "reviewRequired", reason: "missing_landmarks", side: "after" })
  })

  it("rejects finite dimensions whose pixel conversion overflows", () => {
    const huge = { width: Number.MAX_VALUE, height: Number.MAX_VALUE } as const
    const references = { first: { x: 0.9, y: 0.4 }, second: { x: 1, y: 0.4 } } as const
    const result = solveComparisonRegistration({
      angle: "front",
      before: { pose: pose("a", anchors), source: huge, references },
      after: { pose: pose("b", anchors), source: target },
      target,
    })
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "non_finite_reference",
      side: "before",
    })
  })

  it("checks the lower-right target corner for neutral margin", () => {
    const instruction = {
      sourceAnchor: { x: 71, y: 71 },
      targetAnchor: { x: 50, y: 50 },
      targetSize: { width: 100, height: 100 },
      scale: 1,
      rotationDegrees: 45,
    } as const
    expect(instructionLeavesNeutralMargin(instruction, { width: 130, height: 150 })).toBe(true)
  })

  it("reports the measured floating-point projection error", () => {
    const result = solveComparisonRegistration({
      angle: "front",
      before: {
        pose: pose("a", anchors),
        source: { width: 997, height: 613 },
        references: { first: { x: 0.5, y: 0.4 }, second: { x: 0.62, y: 0.58 } },
      },
      after: { pose: pose("b", anchors), source: target },
      target: { width: 752, height: 940 },
    })
    expect(result.kind).toBe("ready")
    if (result.kind === "ready") {
      expect(result.before.preResidualErrorPixels).toBeGreaterThan(0)
      expect(result.before.preResidualErrorPixels).toBeLessThanOrEqual(0.5)
    }
  })
})
