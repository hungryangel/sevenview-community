import { describe, expect, it } from "vitest"
import { solveComparisonRegistration } from "../src/domain/comparison-registration"
import {
  syntheticRegistrationMesh,
  syntheticRegistrationPose,
} from "./support/landmark-registration-fixtures"

const target = { width: 400, height: 500 } as const

describe("landmark fit coordinate safety", () => {
  it("fits pixel geometry correctly when BEFORE and AFTER have different aspect ratios", () => {
    // Given independently computed pixel correspondences with a six-degree roll and 1.1 scale.
    const points = syntheticRegistrationMesh()
    const radians = (6 * Math.PI) / 180
    const moved = points.map(({ x, y }) => ({
      x: (100 + 1.1 * (Math.cos(radians) * x * 1000 - Math.sin(radians) * y * 900)) / 1200,
      y: (20 + 1.1 * (Math.sin(radians) * x * 1000 + Math.cos(radians) * y * 900)) / 1100,
    }))
    // When normalized coordinates are registered from differently shaped source images.
    const result = solveComparisonRegistration({
      angle: "rightOblique",
      before: { pose: syntheticRegistrationPose(points), source: { width: 1000, height: 900 } },
      after: { pose: syntheticRegistrationPose(moved), source: { width: 1200, height: 1100 } },
      target,
    })
    // Then a uniform pixel transform is recovered without anisotropic stretching.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.after.instruction.scale).toBeCloseTo(0.4 / 1.1, 10)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(-6, 10)
    expect(result.after.fit?.inlierCount).toBe(7)
  })

  it("requires review when an upper-face reference lies outside the decoded image", () => {
    // Given finite native detector coordinates that extend outside the image.
    const points = syntheticRegistrationMesh()
    const moved = [...points]
    moved[133] = { x: 1.1, y: 0.4 }
    const source = { width: 1000, height: 1000 }
    // When automatic registration selects the invalid reference.
    const result = solveComparisonRegistration({
      angle: "rightOblique",
      before: { pose: syntheticRegistrationPose(points), source },
      after: { pose: syntheticRegistrationPose(moved), source },
      target,
    })
    // Then the source remains analyzable, but registration cannot silently clamp its landmarks.
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "non_finite_reference",
      side: "after",
    })
  })
})
