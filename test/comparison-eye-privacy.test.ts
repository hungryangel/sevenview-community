import { describe, expect, it } from "vitest"
import {
  createDetectedEyePrivacyMask,
  createManualEyePrivacyMask,
  isUsableEyePrivacyMask,
} from "../src/domain/comparison-eye-privacy"

describe("comparison eye privacy", () => {
  it("derives two conservative normalized eye regions from actual named landmarks", () => {
    const mask = createDetectedEyePrivacyMask({
      screenLeftEyeInner: { x: 0.42, y: 0.4 },
      screenLeftEyeLower: { x: 0.36, y: 0.43 },
      screenLeftEyeOuter: { x: 0.3, y: 0.4 },
      screenLeftEyeUpper: { x: 0.36, y: 0.37 },
      screenRightEyeInner: { x: 0.58, y: 0.4 },
      screenRightEyeLower: { x: 0.64, y: 0.43 },
      screenRightEyeOuter: { x: 0.7, y: 0.4 },
      screenRightEyeUpper: { x: 0.64, y: 0.37 },
    })

    expect(mask).not.toBeNull()
    expect(mask?.provenance).toBe("detected")
    expect(mask?.regions).toHaveLength(2)
    const first = mask?.regions[0]
    expect(first).toBeDefined()
    if (first === undefined) throw new TypeError("Expected detected eye region")
    expect(first.left).toBeLessThan(0.3)
    expect(first.right).toBeGreaterThan(0.42)
    expect(first.top).toBeLessThan(0.37)
    expect(first.bottom).toBeGreaterThan(0.43)
    expect(isUsableEyePrivacyMask(mask)).toBe(true)
  })

  it("rejects missing, non-finite, degenerate, and out-of-source manual geometry", () => {
    expect(createManualEyePrivacyMask({ left: 0.2, top: 0.3, right: 0.8, bottom: 0.5 })).toEqual({
      provenance: "manual",
      regions: [{ left: 0.2, top: 0.3, right: 0.8, bottom: 0.5 }],
    })
    expect(createManualEyePrivacyMask({ left: 0.2, top: 0.3, right: 0.2, bottom: 0.5 })).toBeNull()
    expect(
      createManualEyePrivacyMask({ left: Number.NaN, top: 0.3, right: 0.8, bottom: 0.5 }),
    ).toBeNull()
    expect(createManualEyePrivacyMask({ left: -0.1, top: 0.3, right: 0.8, bottom: 0.5 })).toBeNull()
  })
})
