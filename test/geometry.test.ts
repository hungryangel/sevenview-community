import { describe, expect, it } from "vitest"

import { analyzeFaceAnchors } from "../src/domain/geometry"
import type { FaceAnchors } from "../src/domain/types"

function anchors(
  options: { readonly noseX?: number; readonly noseY?: number; readonly eyeTilt?: number } = {},
): FaceAnchors {
  const noseX = options.noseX ?? 0.5
  const noseY = options.noseY ?? 0.57
  const eyeTilt = options.eyeTilt ?? 0

  return {
    leftEye: { x: 0.35, y: 0.4 - eyeTilt / 2 },
    rightEye: { x: 0.65, y: 0.4 + eyeTilt / 2 },
    noseTip: { x: noseX, y: noseY },
    forehead: { x: 0.5, y: 0.17 },
    chin: { x: 0.5, y: 0.88 },
    leftCheek: { x: 0.2, y: 0.58 },
    rightCheek: { x: 0.8, y: 0.58 },
    mouthLeft: { x: 0.4, y: 0.72 },
    mouthRight: { x: 0.6, y: 0.72 },
    upperLipInner: { x: 0.5, y: 0.72 },
    lowerLipInner: { x: 0.5, y: 0.72 },
    outline: { left: 0.2, right: 0.8 },
  }
}

describe("analyzeFaceAnchors", () => {
  it("computes a positive roll when the right eye is lower", () => {
    // Given: a face whose right eye is 3% lower than the left eye.
    const input = anchors({ eyeTilt: 0.03 })

    // When: the landmarks are analyzed.
    const result = analyzeFaceAnchors(input)

    // Then: the roll reflects the eye-line angle.
    expect(result.rollDegrees).toBeCloseTo(5.71, 1)
  })

  it("normalizes horizontal nose displacement into a yaw score", () => {
    // Given: a nose shifted toward the right cheek.
    const input = anchors({ noseX: 0.62 })

    // When: the landmarks are analyzed.
    const result = analyzeFaceAnchors(input)

    // Then: the yaw score is positive and scale-independent.
    expect(result.yawScore).toBeCloseTo(0.2, 3)
  })

  it("reports a higher pitch score when the nose sits lower between eyes and chin", () => {
    // Given: two otherwise identical faces with different vertical nose positions.
    const raised = anchors({ noseY: 0.52 })
    const lowered = anchors({ noseY: 0.62 })

    // When: both are analyzed.
    const raisedPose = analyzeFaceAnchors(raised)
    const loweredPose = analyzeFaceAnchors(lowered)

    // Then: the lower nose receives the higher relative pitch score.
    expect(loweredPose.pitchScore).toBeGreaterThan(raisedPose.pitchScore)
  })
})

describe("analyzeFaceAnchors — eye center", () => {
  it("exposes the mid-point between both eyes for the eye-level guide", () => {
    const result = analyzeFaceAnchors(anchors({ eyeTilt: 0.02 }))

    expect(result.eyeCenter?.x).toBeCloseTo(0.5, 3)
    expect(result.eyeCenter?.y).toBeCloseTo(0.4, 3)
  })
})

describe("analyzeFaceAnchors — 측면 가로 중심", () => {
  it("centers a profile on the visible face span, not on the collapsed cheek midpoint", () => {
    // 90° 우측면: 양쪽 뺨은 깊이만 다르고 화면 x가 거의 같다(귀 근처 0.34/0.36).
    // 메시 전체는 귀(0.30)에서 코끝(0.78)까지 — 가로 중심은 그 중점(0.54)이어야 한다.
    const metrics = analyzeFaceAnchors({
      ...anchors({ noseX: 0.78 }),
      leftCheek: { x: 0.34, y: 0.58 },
      rightCheek: { x: 0.36, y: 0.58 },
      outline: { left: 0.3, right: 0.78 },
    })
    expect(metrics.anchor.x).toBeCloseTo(0.54, 6)
    // 정면(대칭)에서는 두 방식이 같다.
    expect(analyzeFaceAnchors(anchors()).anchor.x).toBeCloseTo(0.5, 6)
  })
})

describe("analyzeFaceAnchors — 스마일 점수", () => {
  it("rises with mouth width and parted lips, so a smiling frontal outranks a neutral one", () => {
    const neutral = analyzeFaceAnchors(anchors())
    const smiling = analyzeFaceAnchors({
      ...anchors(),
      mouthLeft: { x: 0.35, y: 0.7 },
      mouthRight: { x: 0.65, y: 0.7 },
      upperLipInner: { x: 0.5, y: 0.7 },
      lowerLipInner: { x: 0.5, y: 0.74 },
    })
    // 무표정: 입 폭 0.2 / 뺨 폭 0.6 ≈ 0.333, 벌림 0. 스마일: 0.5 + 0.04/0.71.
    expect(neutral.smileScore).toBeCloseTo(0.333, 3)
    expect(smiling.smileScore ?? 0).toBeGreaterThan((neutral.smileScore ?? 0) + 0.1)
  })
})
