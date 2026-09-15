import { describe, expect, it } from "vitest"
import { FACE_MIRROR_INDICES } from "../src/adapters/face-mirror-topology"
import { metricsFromDetection } from "../src/adapters/mediapipe"
import {
  inverseRecoveryPoints,
  isPlausibleProfileRecovery,
  matchingRecovery,
  PROFILE_RECOVERY_PASSES,
  recoveryTransform,
} from "../src/adapters/profile-recovery-geometry"
import type { Point } from "../src/domain/types"

function mesh(): Point[] {
  const p = Array.from({ length: 478 }, () => ({ x: 0.65, y: 0.5 }))
  p[10] = { x: 0.7, y: 0.2 }
  p[152] = { x: 0.7, y: 0.85 }
  p[168] = { x: 0.76, y: 0.38 }
  p[6] = { x: 0.79, y: 0.45 }
  p[1] = { x: 0.87, y: 0.56 }
  p[33] = { x: 0.66, y: 0.4 }
  p[133] = { x: 0.76, y: 0.4 }
  p[263] = { x: 0.8, y: 0.4 }
  p[362] = { x: 0.81, y: 0.4 }
  p[234] = { x: 0.5, y: 0.5 }
  p[454] = { x: 0.65, y: 0.5 }
  p[13] = { x: 0.79, y: 0.68 }
  p[14] = { x: 0.79, y: 0.7 }
  return p
}
const parsed = (points: readonly Point[]) => metricsFromDetection({ faceLandmarks: [points] })

describe("profile re-detection in original coordinates", () => {
  it("preserves every anatomical index after padding, rotation and mirror inversion", () => {
    const source = { width: 344, height: 394 }
    for (const pass of PROFILE_RECOVERY_PASSES) {
      const t = recoveryTransform(source, pass)
      const points = mesh()
      const detected = points.map((_, i) => {
        const mappedIndex = pass.mirror ? FACE_MIRROR_INDICES[i] : i
        const p = mappedIndex === undefined ? undefined : points[mappedIndex]
        if (p === undefined) throw new Error("Missing test point")
        const x = (p.x - 0.5) * source.width * t.scale * (pass.mirror ? -1 : 1)
        const y = (p.y - 0.5) * source.height * t.scale
        return {
          x: (320 + Math.cos(t.radians) * x - Math.sin(t.radians) * y) / 640,
          y: (320 + Math.sin(t.radians) * x + Math.cos(t.radians) * y) / 640,
        }
      })
      const recovered = inverseRecoveryPoints(detected, t)
      for (const [i, point] of recovered.entries()) {
        const expected = points[i]
        if (expected === undefined) throw new Error("Missing expected point")
        expect(point.x).toBeCloseTo(expected.x, 12)
        expect(point.y).toBeCloseTo(expected.y, 12)
      }
    }
    expect(PROFILE_RECOVERY_PASSES.length).toBeLessThanOrEqual(18)
  })

  it("uses a bijective involution including correct iris rim orientation", () => {
    expect(new Set(FACE_MIRROR_INDICES).size).toBe(478)
    FACE_MIRROR_INDICES.forEach((other, index) => {
      expect(FACE_MIRROR_INDICES[other]).toBe(index)
    })
    expect(FACE_MIRROR_INDICES.slice(468)).toEqual([
      473, 476, 475, 474, 477, 468, 471, 470, 469, 472,
    ])
  })

  it("rejects sideways hallucinated faces, missing points and extreme hidden-eye tilt", () => {
    const valid = parsed(mesh())
    expect(isPlausibleProfileRecovery(valid)).toBe(true)
    expect(isPlausibleProfileRecovery(parsed(mesh().map((p) => ({ x: p.y, y: 1 - p.x }))))).toBe(
      false,
    )
    expect(isPlausibleProfileRecovery({ ...valid, rollDegrees: 38 })).toBe(false)
    expect(isPlausibleProfileRecovery({ ...valid, yawScore: 0.1 })).toBe(false)
    const { landmarkGeometry: _geometry, ...withoutGeometry } = valid
    expect(isPlausibleProfileRecovery(withoutGeometry)).toBe(false)
  })

  it("requires agreeing independent predictions and never averages deformed face geometry", () => {
    const first = parsed(mesh())
    const near = parsed(mesh().map((p) => ({ x: p.x + 0.002, y: p.y - 0.001 })))
    const far = parsed(mesh().map((p) => ({ x: p.x - 0.12, y: p.y })))
    expect(matchingRecovery([first], near)).toBe(first)
    expect(matchingRecovery([first], far)).toBeNull()
    expect(matchingRecovery([], near)).toBeNull()
    expect(matchingRecovery([first], { ...near, yawScore: -near.yawScore })).toBeNull()
  })
})
