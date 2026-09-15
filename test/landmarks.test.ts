import { describe, expect, it } from "vitest"

import {
  extractFaceAnchors,
  extractShoulderAnchors,
  FaceLandmarksError,
} from "../src/adapters/landmarks"

type Landmark = {
  readonly x: number
  readonly y: number
}

function landmarkSet(): Landmark[] {
  return Array.from({ length: 478 }, (_, index) => ({
    x: index / 1_000,
    y: index / 2_000,
  }))
}

describe("extractFaceAnchors", () => {
  it("maps MediaPipe face mesh indices into stable SevenView anchors", () => {
    // Given: a complete MediaPipe 478-landmark face mesh.
    const landmarks = landmarkSet()

    // When: the adapter extracts only the geometry needed by the domain.
    const result = extractFaceAnchors(landmarks)

    // Then: eye centers and single-point anchors use the documented indices.
    expect(result.leftEye).toEqual({ x: 0.083, y: 0.0415 })
    expect(result.rightEye).toEqual({ x: 0.3125, y: 0.15625 })
    expect(result.noseTip).toEqual({ x: 0.001, y: 0.0005 })
    expect(result.forehead).toEqual({ x: 0.01, y: 0.005 })
    expect(result.chin).toEqual({ x: 0.152, y: 0.076 })
    // 메시 가로 범위: x = index/1000 → 0 ~ 0.477.
    expect(result.outline).toEqual({ left: 0, right: 0.477 })
    // 입꼬리·입술 안쪽 점(61·291·13·14).
    expect(result.mouthLeft).toEqual({ x: 0.061, y: 0.0305 })
    expect(result.mouthRight).toEqual({ x: 0.291, y: 0.1455 })
    expect(result.upperLipInner).toEqual({ x: 0.013, y: 0.0065 })
    expect(result.lowerLipInner).toEqual({ x: 0.014, y: 0.007 })
    expect(result.leftCheek).toEqual({ x: 0.234, y: 0.117 })
    expect(result.rightCheek).toEqual({ x: 0.454, y: 0.227 })
  })

  it("rejects an incomplete landmark result at the adapter boundary", () => {
    // Given: a result too short to contain the right cheek anchor.
    const landmarks = landmarkSet().slice(0, 454)

    // When/Then: the boundary emits a typed detection error.
    expect(() => extractFaceAnchors(landmarks)).toThrow(FaceLandmarksError)
  })
})

describe("extractShoulderAnchors", () => {
  it("reads the two pose shoulder landmarks and keeps the weaker visibility", () => {
    const landmarks = Array.from({ length: 33 }, (_, index) => ({
      x: index / 100,
      y: index / 200,
      visibility: 0.9,
    }))
    landmarks[11] = { x: 0.62, y: 0.71, visibility: 0.95 }
    landmarks[12] = { x: 0.38, y: 0.73, visibility: 0.6 }

    expect(extractShoulderAnchors(landmarks)).toEqual({
      left: { x: 0.62, y: 0.71 },
      right: { x: 0.38, y: 0.73 },
      visibility: 0.6,
    })
  })

  it("returns null when the pose result is too short to contain shoulders", () => {
    expect(extractShoulderAnchors([{ x: 0.5, y: 0.5, visibility: 1 }])).toBeNull()
  })
})
