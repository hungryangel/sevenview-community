import { describe, expect, it } from "vitest"
import { solveComparisonRegistration } from "../src/domain/comparison-registration"
import { projectPointToTarget } from "../src/domain/render-plan"
import { type PhotoPose, photoId } from "../src/domain/types"

const target = { width: 400, height: 500 } as const
const source = { width: 1000, height: 1000 } as const

function pose(direction: number): PhotoPose {
  const radians = (direction * Math.PI) / 180
  return {
    id: photoId(`direction-${direction}`),
    yawScore: 0.4,
    pitchScore: 0.5,
    rollDegrees: 0,
    confidence: 0.9,
    bounds: { left: 0.2, top: 0.05, right: 0.8, bottom: 0.8 },
    anchor: { x: 0.5, y: 0.5 },
    registrationAnchors: {
      screenLeftEye: { x: 0.3, y: 0.4 },
      screenRightEye: { x: 0.5, y: 0.4 },
      noseTip: { x: 0.4 + 0.2 * Math.cos(radians), y: 0.4 + 0.2 * Math.sin(radians) },
    },
  }
}

describe("relative lateral registration", () => {
  it.each(["rightOblique", "leftOblique", "rightProfile", "leftProfile"] as const)(
    "keeps the whole BEFORE source upright when registering %s",
    (angle) => {
      // Given an upright photo whose facial depth vector is naturally steep.
      const before = { pose: pose(60), source }
      // When both panels use the same source.
      const result = solveComparisonRegistration({ angle, before, after: before, target })
      // Then BEFORE uses centered contain-fit, and both rotations are exactly zero.
      expect(result.kind).toBe("ready")
      if (result.kind !== "ready") return
      expect(result.before.instruction).toEqual({
        sourceAnchor: { x: 500, y: 500 },
        targetAnchor: { x: 200, y: 250 },
        scale: 0.4,
        rotationDegrees: 0,
        targetSize: target,
      })
      expect(result.after.instruction.rotationDegrees).toBe(0)
      expect(projectPointToTarget(result.before.instruction, { x: 0, y: 0 })).toEqual({
        x: 0,
        y: 50,
      })
      expect(projectPointToTarget(result.before.instruction, { x: 1000, y: 1000 })).toEqual({
        x: 400,
        y: 450,
      })
      expect(result.before.neutralMargin).toBe(true)
    },
  )

  it("aligns AFTER relatively when its image roll differs by ten degrees", () => {
    // Given corresponding reference vectors with a ten-degree difference.
    const before = { pose: pose(60), source }
    const after = { pose: pose(70), source }
    // When lateral registration is solved.
    const result = solveComparisonRegistration({ angle: "rightOblique", before, after, target })
    // Then only AFTER rotates and both reference pairs share one target.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.before.instruction.rotationDegrees).toBe(0)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(-10, 10)
    expect(result.before.targetReferences).toEqual(result.after.targetReferences)
    expect(result.after.preResidualErrorPixels).toBeLessThanOrEqual(0.5)
  })

  it.each([16, -16, 30, -30])(
    "requires review when automatic AFTER rotation is %s degrees",
    (delta) => {
      // Given facial reference directions beyond the automatic roll guard.
      const before = { pose: pose(60), source }
      const after = { pose: pose(60 - delta), source }
      // When registration is automatic.
      const result = solveComparisonRegistration({ angle: "rightOblique", before, after, target })
      // Then the AFTER instruction is withheld.
      expect(result).toEqual({
        kind: "reviewRequired",
        reason: "rotation_review_required",
        side: "after",
      })
    },
  )

  it.each([15, -15])("allows automatic rotation exactly at the %s-degree boundary", (delta) => {
    // Given two detected vectors whose relative direction is exactly on the guard boundary.
    const before = { pose: pose(60), source }
    const after = { pose: pose(60 - delta), source }
    // When automatic registration is solved.
    const result = solveComparisonRegistration({ angle: "rightProfile", before, after, target })
    // Then only angles above the boundary require review.
    expect(result.kind).toBe("ready")
    if (result.kind === "ready")
      expect(result.after.instruction.rotationDegrees).toBeCloseTo(delta, 10)
  })

  it("retains front eye leveling when the eye pair is steeply rolled", () => {
    // Given a frontal eye pair tilted 45 degrees in pixel coordinates.
    const frontal = {
      ...pose(60),
      registrationAnchors: {
        screenLeftEye: { x: 0.3, y: 0.3 },
        screenRightEye: { x: 0.5, y: 0.5 },
        noseTip: { x: 0.4, y: 0.6 },
      },
    }
    const before = { pose: frontal, source }
    // When front registration uses its horizontal eye target.
    const result = solveComparisonRegistration({ angle: "front", before, after: before, target })
    // Then front retains its established leveling behavior beyond the lateral guard.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.before.instruction.rotationDegrees).toBeCloseTo(-45, 10)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(-45, 10)
    expect(result.before.targetReferences).toEqual({
      first: { x: 140, y: 200 },
      second: { x: 260, y: 200 },
    })
  })

  it("uses the short rotation when reference directions cross minus/plus 180 degrees", () => {
    // Given two leftward vectors straddling the atan2 branch boundary.
    const before = { pose: pose(179), source }
    const after = { pose: pose(-179), source }
    // When solving relative registration.
    const result = solveComparisonRegistration({ angle: "leftProfile", before, after, target })
    // Then the rotation is minus two degrees, not 358 degrees.
    expect(result.kind).toBe("ready")
    if (result.kind === "ready")
      expect(result.after.instruction.rotationDegrees).toBeCloseTo(-2, 10)
  })

  it("accepts a large rotation when both pairs were manually confirmed", () => {
    // Given two explicit valid manual pairs, ninety degrees apart.
    const before = {
      pose: pose(60),
      source,
      references: { first: { x: 0.4, y: 0.4 }, second: { x: 0.6, y: 0.4 } },
    }
    const after = {
      pose: pose(60),
      source,
      references: { first: { x: 0.4, y: 0.4 }, second: { x: 0.4, y: 0.6 } },
    }
    // When registration is solved with manual references on both sources.
    const result = solveComparisonRegistration({ angle: "rightProfile", before, after, target })
    // Then the user-confirmed correspondence is honored.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.before.instruction.rotationDegrees).toBe(0)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(-90, 10)
    expect(result.after.provenance).toBe("manual")
  })

  it("still requires review when just one pair is manual", () => {
    // Given automatic BEFORE references and manually selected AFTER references.
    const before = { pose: pose(0), source }
    const after = {
      pose: pose(0),
      source,
      references: { first: { x: 0.4, y: 0.4 }, second: { x: 0.4, y: 0.6 } },
    }
    // When the relative rotation is beyond the automatic guard.
    const result = solveComparisonRegistration({ angle: "rightProfile", before, after, target })
    // Then one explicit pair does not confirm the whole correspondence.
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "rotation_review_required",
      side: "after",
    })
  })

  it("rejects coincident points even when both pairs are manually confirmed", () => {
    // Given a manual AFTER pair whose points coincide.
    const before = {
      pose: pose(60),
      source,
      references: { first: { x: 0.4, y: 0.4 }, second: { x: 0.6, y: 0.4 } },
    }
    const after = {
      pose: pose(60),
      source,
      references: { first: { x: 0.4, y: 0.4 }, second: { x: 0.4, y: 0.4 } },
    }
    // When the manual correspondence is solved.
    const result = solveComparisonRegistration({ angle: "rightProfile", before, after, target })
    // Then manual confirmation does not bypass valid two-point geometry.
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "coincident_reference",
      side: "after",
    })
  })

  it.each([1, 1.88, 2])(
    "preserves normalized composition when output dimensions are multiplied by %s",
    (factor) => {
      // Given an asymmetric source composition and proportional export dimensions.
      const before = { pose: pose(60), source: { width: 1200, height: 900 } }
      const snapshot = structuredClone(before)
      const output = { width: target.width * factor, height: target.height * factor }
      // When registering the same photo at a selected output resolution.
      const result = solveComparisonRegistration({
        angle: "rightOblique",
        before,
        after: before,
        target: output,
      })
      // Then the entire source receives the same proportional contain-fit.
      expect(result.kind).toBe("ready")
      if (result.kind !== "ready") return
      expect(result.before.instruction.scale / factor).toBeCloseTo(1 / 3, 10)
      expect(result.before.targetReferences.first.x / output.width).toBeCloseTo(0.4, 10)
      expect(result.before.targetReferences.first.y / output.height).toBeCloseTo(0.44, 10)
      expect(before).toEqual(snapshot)
    },
  )
})
