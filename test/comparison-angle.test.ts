import { describe, expect, it } from "vitest"
import { resolveComparisonAngle } from "../src/domain/comparison-angle"
import { type PhotoPose, photoId } from "../src/domain/types"

function pose(yawScore: number, pitchScore = 0.5): PhotoPose {
  return {
    id: photoId(`pose-${yawScore}-${pitchScore}`),
    yawScore,
    pitchScore,
    rollDegrees: 0,
    confidence: 0.9,
    bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
    anchor: { x: 0.5, y: 0.5 },
  }
}

describe("resolveComparisonAngle", () => {
  it.each([
    [0, "front"],
    [0.179, "front"],
    [-0.179, "front"],
    [0.18, "rightOblique"],
    [-0.18, "leftOblique"],
    [0.699, "rightOblique"],
    [-0.699, "leftOblique"],
    [0.7, "rightProfile"],
    [-0.7, "leftProfile"],
  ] as const)("automatically resolves yaw %s as %s when both photos agree", (yaw, angle) => {
    // Given matching categories but different pitch values.
    const before = pose(yaw, 0.15)
    const after = pose(yaw, 0.8)
    // When no manual angle override was selected.
    const result = resolveComparisonAngle({ before, after, override: null })
    // Then the comparison uses its yaw category without inventing an up/down category.
    expect(result).toEqual({
      kind: "ready",
      angle,
      before: angle,
      after: angle,
      provenance: "automatic",
    })
  })

  it.each([
    [0, 0.4, "front", "rightOblique"],
    [0.4, -0.4, "rightOblique", "leftOblique"],
    [0.4, 0.8, "rightOblique", "rightProfile"],
  ] as const)(
    "requires review when BEFORE yaw %s and AFTER yaw %s disagree",
    (beforeYaw, afterYaw, beforeAngle, afterAngle) => {
      // Given different categories on the original BEFORE and AFTER sources.
      const before = pose(beforeYaw)
      const after = pose(afterYaw)
      // When the angle has not been manually confirmed.
      const result = resolveComparisonAngle({ before, after, override: null })
      // Then inferred labels retain source order and no angle is selected.
      expect(result).toEqual({
        kind: "reviewRequired",
        reason: "angle_mismatch",
        before: beforeAngle,
        after: afterAngle,
      })
    },
  )

  it("honors an explicit override while preserving both inferred source labels", () => {
    // Given an actual right-oblique/left-profile mismatch and an explicit front override.
    const input = { before: pose(0.4), after: pose(-0.8), override: "front" } as const
    const original = structuredClone(input)
    // When the user selects the comparison angle.
    const result = resolveComparisonAngle(input)
    // Then the override is visible as manual, without swapping or mutating the sources.
    expect(result).toEqual({
      kind: "ready",
      angle: "front",
      before: "rightOblique",
      after: "leftProfile",
      provenance: "manual",
    })
    expect(input).toEqual(original)
  })

  it("keeps manual provenance when an override differs from matching inferred categories", () => {
    // Given two frontal photos and a selected right profile angle.
    const before = pose(0)
    const after = pose(0.01)
    // When resolving the explicit override.
    const result = resolveComparisonAngle({ before, after, override: "rightProfile" })
    // Then manual precedence remains observable even without a mismatch.
    expect(result).toEqual({
      kind: "ready",
      angle: "rightProfile",
      before: "front",
      after: "front",
      provenance: "manual",
    })
  })

  it.each([
    [Number.NaN, 0.5],
    [Number.POSITIVE_INFINITY, 0.5],
    [0, Number.NaN],
    [0, Number.NEGATIVE_INFINITY],
  ])("requires review when BEFORE has nonfinite yaw/pitch %s/%s", (yaw, pitch) => {
    // Given an invalid BEFORE pose and a valid AFTER pose.
    const before = pose(yaw, pitch)
    const after = pose(-0.8)
    // When even a manual override is supplied.
    const result = resolveComparisonAngle({ before, after, override: "front" })
    // Then invalid pose data cannot be silently reclassified.
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "invalid_pose",
      before: null,
      after: "leftProfile",
    })
  })

  it("keeps the valid BEFORE category when only AFTER pose data is invalid", () => {
    // Given valid BEFORE and invalid AFTER yaw.
    const before = pose(0.4)
    const after = pose(Number.NaN)
    // When resolving automatic angles.
    const result = resolveComparisonAngle({ before, after, override: null })
    // Then only the invalid side loses its inferred category.
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "invalid_pose",
      before: "rightOblique",
      after: null,
    })
  })
})
