import { describe, expect, it } from "vitest"
import { solveComparisonRegistration } from "../src/domain/comparison-registration"
import { projectPointToTarget } from "../src/domain/render-plan"
import {
  moveSyntheticMesh,
  syntheticRegistrationMesh,
  syntheticRegistrationPose,
} from "./support/landmark-registration-fixtures"

const source = { width: 1000, height: 1000 } as const
const target = { width: 400, height: 500 } as const

describe("upper-face landmark registration", () => {
  it("recovers a known uniform similarity from independent synthetic anchor correspondences", () => {
    // Given AFTER is an independently specified 1.2 scale, eight-degree roll, and translation.
    const points = syntheticRegistrationMesh()
    const before = { pose: syntheticRegistrationPose(points), source }
    const after = { pose: syntheticRegistrationPose(moveSyntheticMesh(points)), source }
    // When stable upper-face landmarks align to the BEFORE projection.
    const result = solveComparisonRegistration({ angle: "front", before, after, target })
    // Then scale/roll are recovered and all seven stable references contribute.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.after.fit).toMatchObject({
      method: "upper_face_similarity",
      referenceCount: 7,
      inlierCount: 7,
    })
    expect(result.after.instruction.scale).toBeCloseTo(result.before.instruction.scale / 1.2, 10)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(
      result.before.instruction.rotationDegrees - 8,
      10,
    )
    expect(result.after.fit?.residualErrorPixels).toBeLessThan(1e-9)
    const expected = projectPointToTarget(result.before.instruction, { x: 520, y: 400 })
    const movedBridge = moveSyntheticMesh([{ x: 0.52, y: 0.4 }])[0]
    if (movedBridge === undefined) throw new Error("Synthetic bridge is missing")
    const actual = projectPointToTarget(result.after.instruction, {
      x: movedBridge.x * 1000,
      y: movedBridge.y * 1000,
    })
    expect(actual.x).toBeCloseTo(expected.x, 10)
    expect(actual.y).toBeCloseTo(expected.y, 10)
    expect(result.after.fit?.references).toHaveLength(7)
    const bridge = result.after.fit?.references.find(
      (reference) => reference.name === "noseBridgeLower",
    )
    expect(bridge?.source).toEqual({ x: movedBridge.x * 1000, y: movedBridge.y * 1000 })
    expect(bridge?.target).toEqual(expected)
  })

  it("rejects one displaced corner from the least-squares fit when the other anchors agree", () => {
    // Given one corrupted AFTER eye corner among seven valid upper-face references.
    const points = syntheticRegistrationMesh()
    const moved = moveSyntheticMesh(points)
    moved[33] = { x: 0.08, y: 0.8 }
    // When robust automatic registration is solved.
    const result = solveComparisonRegistration({
      angle: "rightOblique",
      before: { pose: syntheticRegistrationPose(points), source },
      after: { pose: syntheticRegistrationPose(moved), source },
      target,
    })
    // Then the six agreeing anchors recover the independent similarity.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.after.fit?.inlierCount).toBe(6)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(-8, 10)
    expect(result.after.instruction.scale).toBeCloseTo(1 / 3, 10)
    expect(result.after.fit?.references).toHaveLength(6)
    expect(
      result.after.fit?.references.some((reference) => reference.name === "screenLeftEyeOuter"),
    ).toBe(false)
  })

  it("excludes changed jaw, cheek, lip and nose-tip geometry from automatic fitting", () => {
    // Given unchanged upper-face geometry and substantial lower-face changes.
    const points = syntheticRegistrationMesh()
    const afterPoints = [...points]
    for (const index of [1, 152, 234, 454, 61, 291, 13, 14]) afterPoints[index] = { x: 0.9, y: 0.9 }
    // When the comparison is solved automatically.
    const result = solveComparisonRegistration({
      angle: "rightOblique",
      before: { pose: syntheticRegistrationPose(points), source },
      after: { pose: syntheticRegistrationPose(afterPoints), source },
      target,
    })
    // Then the treatment area does not pull the registration or create false roll.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.after.fit?.referenceCount).toBe(7)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(0, 10)
    expect(result.after.instruction.scale).toBeCloseTo(0.4, 10)
  })

  it("uses only the wider visible eye when a profile has an unstable hidden eye", () => {
    // Given a profile whose smaller right projected eye moves without actual image roll.
    const points = syntheticRegistrationMesh()
    points[362] = { x: 0.7, y: 0.375 }
    const afterPoints = [...points]
    afterPoints[263] = { x: 0.95, y: 0.2 }
    afterPoints[362] = { x: 0.92, y: 0.25 }
    // When profile registration uses homologous upper-face references.
    const result = solveComparisonRegistration({
      angle: "rightProfile",
      before: { pose: syntheticRegistrationPose(points), source },
      after: { pose: syntheticRegistrationPose(afterPoints), source },
      target,
    })
    // Then the hidden eye has no contribution and BEFORE preserves its source orientation.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.before.instruction.rotationDegrees).toBe(0)
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(0, 10)
    expect(result.after.fit).toMatchObject({ referenceCount: 5, inlierCount: 5 })
  })

  it("requires review when real geometry produces more than fifteen degrees of nonfront roll", () => {
    // Given a known 20-degree image roll between corresponding stable anchors.
    const points = syntheticRegistrationMesh()
    // When nonfront alignment is automatic.
    const result = solveComparisonRegistration({
      angle: "leftOblique",
      before: { pose: syntheticRegistrationPose(points), source },
      after: { pose: syntheticRegistrationPose(moveSyntheticMesh(points, 20)), source },
      target,
    })
    // Then the existing rotation guard still withholds the instruction.
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "rotation_review_required",
      side: "after",
    })
  })

  it("keeps explicit manual pairs authoritative when complete detected geometry is present", () => {
    // Given geometry suggesting -8 degrees but manual pairs specifying -90 degrees.
    const points = syntheticRegistrationMesh()
    const first = { first: { x: 0.4, y: 0.4 }, second: { x: 0.6, y: 0.4 } }
    const second = { first: { x: 0.4, y: 0.4 }, second: { x: 0.4, y: 0.6 } }
    // When both manual correspondences are supplied.
    const result = solveComparisonRegistration({
      angle: "rightProfile",
      before: { pose: syntheticRegistrationPose(points), source, references: first },
      after: {
        pose: syntheticRegistrationPose(moveSyntheticMesh(points)),
        source,
        references: second,
      },
      target,
    })
    // Then manual two-point alignment wins and no automatic fit is claimed.
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.after.instruction.rotationDegrees).toBeCloseTo(-90, 10)
    expect(result.after.fit).toBeUndefined()
    expect(result.after.provenance).toBe("manual")
  })

  it("accepts a pair with no detected pose when both manual references are supplied", () => {
    // Given two retained decoded sources without any detected face pose.
    const references = { first: { x: 0.3, y: 0.3 }, second: { x: 0.6, y: 0.3 } }
    const manual = { pose: null, source, references }
    // When the explicit pair is solved.
    const result = solveComparisonRegistration({
      angle: "front",
      before: manual,
      after: manual,
      target,
    })
    // Then no fabricated pose is needed to support manual registration.
    expect(result.kind).toBe("ready")
    if (result.kind === "ready") expect(result.after.provenance).toBe("manual")
  })

  it.each([15, -15])(
    "accepts the exact %s-degree boundary for automatic landmark fitting",
    (degrees) => {
      // Given a known roll exactly on the inclusive automatic boundary.
      const points = syntheticRegistrationMesh()
      // When the real geometry path is solved.
      const result = solveComparisonRegistration({
        angle: "leftProfile",
        before: { pose: syntheticRegistrationPose(points), source },
        after: { pose: syntheticRegistrationPose(moveSyntheticMesh(points, degrees)), source },
        target,
      })
      // Then floating-point fitting does not turn the inclusive limit into a rejection.
      expect(result.kind).toBe("ready")
      if (result.kind === "ready")
        expect(result.after.instruction.rotationDegrees).toBeCloseTo(-degrees, 10)
    },
  )

  it("requests review instead of falling back when upper-face geometry has no stable consensus", () => {
    // Given inconsistent eye corners while three midline points still agree.
    const points = syntheticRegistrationMesh()
    const moved = [...points]
    moved[33] = { x: 0.1, y: 0.7 }
    moved[133] = { x: 0.8, y: 0.2 }
    moved[263] = { x: 0.4, y: 0.6 }
    moved[362] = { x: 0.65, y: 0.8 }
    // When automatic landmark registration is attempted.
    const result = solveComparisonRegistration({
      angle: "rightOblique",
      before: { pose: syntheticRegistrationPose(points), source },
      after: { pose: syntheticRegistrationPose(moved), source },
      target,
    })
    // Then a valid old midline pair cannot silently mask a failed multi-reference fit.
    expect(result).toEqual({
      kind: "reviewRequired",
      reason: "unstable_landmark_fit",
      side: "after",
    })
  })

  it("requires references when the decoded source has no detected pose", () => {
    // Given a decoded image without a real face pose or manual references.
    const missing = { pose: null, source }
    // When registration is requested.
    const result = solveComparisonRegistration({
      angle: "front",
      before: missing,
      after: missing,
      target,
    })
    // Then absence of geometry remains explicit rather than creating a synthetic pose.
    expect(result).toEqual({ kind: "reviewRequired", reason: "missing_landmarks", side: "before" })
  })
})
