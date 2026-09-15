import { describe, expect, it } from "vitest"

import { solveComparisonRegistration } from "../src/domain/comparison-registration"
import { projectPointToTarget } from "../src/domain/render-plan"
import {
  syntheticRegistrationMesh,
  syntheticRegistrationPose,
} from "./support/landmark-registration-fixtures"

const source = { width: 400, height: 500 }
const references = { first: { x: 0.5, y: 0.2 }, second: { x: 0.5, y: 0.5 } }

describe("generic paired reference recovery", () => {
  it("preserves a no-face front source when corresponding points are vertical", () => {
    const result = solveComparisonRegistration({
      angle: "front",
      before: { pose: null, source, references },
      after: { pose: null, source, references },
      target: source,
    })
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw new Error("Manual pair was rejected")
    for (const side of [result.before, result.after]) {
      expect(side.instruction.rotationDegrees).toBe(0)
      expect(side.instruction.scale).toBe(1)
      expect(projectPointToTarget(side.instruction, { x: 200, y: 100 })).toEqual({ x: 200, y: 100 })
    }
  })

  it.each(["before", "after"] as const)(
    "requires the other explicit pair after %s recovery even when geometry exists",
    (side) => {
      const detected = { pose: syntheticRegistrationPose(syntheticRegistrationMesh()), source }
      const result = solveComparisonRegistration({
        angle: "rightProfile",
        manualRecovery: true,
        before: side === "before" ? { ...detected, references } : detected,
        after: side === "after" ? { ...detected, references } : detected,
        target: source,
      })
      expect(result).toEqual({
        kind: "reviewRequired",
        reason: "missing_landmarks",
        side: side === "before" ? "after" : "before",
      })
    },
  )

  it("aligns generic detected front pairs relatively without forcing eye targets or using the mesh", () => {
    const detected = { pose: syntheticRegistrationPose(syntheticRegistrationMesh()), source }
    const result = solveComparisonRegistration({
      angle: "front",
      manualRecovery: true,
      before: { ...detected, references },
      after: { ...detected, references: { first: { x: 0.6, y: 0.3 }, second: { x: 0.6, y: 0.6 } } },
      target: source,
    })
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw new Error("Manual pair was rejected")
    expect(result.before.instruction.rotationDegrees).toBe(0)
    expect(result.after.instruction.rotationDegrees).toBe(0)
    expect(result.after.fit).toBeUndefined()
    expect(projectPointToTarget(result.after.instruction, { x: 240, y: 150 })).toEqual({
      x: 200,
      y: 100,
    })
  })
})
