import { describe, expect, it } from "vitest"

import { type PhotoPose, photoId } from "../src/domain/types"
import {
  chinUpQualifies,
  crownDownQualifies,
  detectViewPoseMismatch,
  isConfidentProfile,
  isDistinctLateralPose,
  isFrontalBand,
  isLateralCandidate,
  measuredPitchMedian,
  setPitchMedian,
  suggestViewForPose,
} from "../src/domain/view-plausibility"

const pose = (yawScore: number): PhotoPose => ({
  id: photoId("probe"),
  yawScore,
  pitchScore: 0.4,
  rollDegrees: 0,
  confidence: 0.9,
  bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
  anchor: { x: 0.5, y: 0.5 },
})

describe("view plausibility gates", () => {
  it("keeps worst-case frontal yaw noise (±0.15) out of the lateral candidates", () => {
    expect(isLateralCandidate(pose(0.15), 1)).toBe(false)
    expect(isLateralCandidate(pose(-0.15), -1)).toBe(false)
    expect(isFrontalBand(pose(0.15))).toBe(true)
  })

  it("admits measured oblique and profile yaw as lateral candidates on the matching side only", () => {
    expect(isLateralCandidate(pose(0.436), 1)).toBe(true)
    expect(isLateralCandidate(pose(1.027), 1)).toBe(true)
    expect(isLateralCandidate(pose(0.436), -1)).toBe(false)
    expect(isFrontalBand(pose(0.436))).toBe(false)
  })

  it("treats only the measured profile band as a confident lone profile", () => {
    expect(isConfidentProfile(pose(1.027))).toBe(true)
    expect(isConfidentProfile(pose(-0.952))).toBe(true)
    expect(isConfidentProfile(pose(0.436))).toBe(false)
  })

  it("requires a directional pitch departure from the set median for 턱밑·정수리", () => {
    const median = 0.367
    expect(chinUpQualifies(0.047, median)).toBe(true)
    expect(crownDownQualifies(0.648, median)).toBe(true)
    // 정면대 산포(≈0.02) 수준의 이탈은 두 방향 모두 거부한다.
    expect(chinUpQualifies(0.35, median)).toBe(false)
    expect(crownDownQualifies(0.38, median)).toBe(false)
    // 방향이 반대면 이탈이 커도 거부한다.
    expect(chinUpQualifies(0.648, median)).toBe(false)
    expect(crownDownQualifies(0.047, median)).toBe(false)
  })

  it("treats a repeated file as one pose while keeping close real angles distinct", () => {
    expect(isDistinctLateralPose(pose(1.027), pose(1.027))).toBe(false)
    expect(isDistinctLateralPose(pose(1.0), pose(0.99))).toBe(false)
    expect(isDistinctLateralPose(pose(1.027), pose(0.436))).toBe(true)
    // 실사 프로브 수준: 측면 0.33 vs 45도 0.28 — yaw 차 0.05는 다른 각도다.
    expect(isDistinctLateralPose(pose(0.33), pose(0.28))).toBe(true)
    // yaw가 같아도 pitch가 다르면 다른 자세다.
    expect(isDistinctLateralPose(pose(0.44), { ...pose(0.44), pitchScore: 0.3 })).toBe(true)
  })

  it("computes the set pitch median with an even count and a safe fallback", () => {
    expect(setPitchMedian([0.3, 0.5])).toBe(0.5)
    expect(setPitchMedian([0.2, 0.4, 0.6])).toBe(0.4)
    expect(setPitchMedian([])).toBe(0.5)
  })
})

describe("수동 배치 감시 — detectViewPoseMismatch", () => {
  const measured = (yawScore: number, pitchScore: number): PhotoPose => ({
    ...pose(yawScore),
    pitchScore,
    eyeCenter: { x: 0.5, y: 0.4 },
  })
  const median = 0.367

  it("flags the reported case: a crown-down photo placed into 우측 측면", () => {
    // 정수리 사진(yaw≈0, pitch 0.648)을 수동으로
    // 우측 측면에 넣으면 경고가 떠야 한다.
    expect(detectViewPoseMismatch("rightProfile", measured(0.02, 0.648), median)).toEqual({
      kind: "not_lateral",
    })
    expect(suggestViewForPose(measured(0.02, 0.648), median)).toBe("crownDown")
  })

  it("flags wrong-side, non-frontal, and shallow/opposite pitch placements", () => {
    expect(detectViewPoseMismatch("leftProfile", measured(0.95, 0.36), median)).toEqual({
      kind: "wrong_side",
    })
    expect(detectViewPoseMismatch("front", measured(0.44, 0.36), median)).toEqual({
      kind: "not_frontal",
    })
    expect(detectViewPoseMismatch("front", measured(0, 0.648), median)).toEqual({
      kind: "pitch_extreme",
    })
    expect(detectViewPoseMismatch("chinUp", measured(0, 0.38), median)).toEqual({
      kind: "pitch_shallow",
    })
    expect(detectViewPoseMismatch("chinUp", measured(0, 0.648), median)).toEqual({
      kind: "pitch_opposite",
    })
  })

  it("keeps measured legit placements and landmark-less manual photos silent", () => {
    expect(detectViewPoseMismatch("rightProfile", measured(1.027, 0.358), median)).toBeNull()
    expect(detectViewPoseMismatch("rightOblique", measured(0.436, 0.36), median)).toBeNull()
    expect(detectViewPoseMismatch("front", measured(0, 0.38), median)).toBeNull()
    expect(detectViewPoseMismatch("crownDown", measured(0.02, 0.648), median)).toBeNull()
    // 랜드마크 없는 사진(실패 복구 수동 배치)은 측정이 없으므로 판정하지 않는다.
    expect(detectViewPoseMismatch("rightProfile", pose(0), median)).toBeNull()
  })

  it("suggests the same bands the assignment rules use", () => {
    expect(suggestViewForPose(measured(1.0, 0.36), median)).toBe("rightProfile")
    expect(suggestViewForPose(measured(-0.44, 0.36), median)).toBe("leftOblique")
    expect(suggestViewForPose(measured(0, 0.047), median)).toBe("chinUp")
    expect(suggestViewForPose(measured(0, 0.38), median)).toBe("front")
  })

  it("computes the judging median only from photos with landmarks", () => {
    expect(
      measuredPitchMedian([measured(0, 0.3), measured(0, 0.5), { ...pose(0), pitchScore: 0.9 }]),
    ).toBe(0.5)
  })
})
