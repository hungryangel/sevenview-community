import { describe, expect, it } from "vitest"

import {
  classifyPhotoError,
  DISPLAY_MAX_EDGE,
  ImageDecodeError,
  scaledDecodeSize,
} from "../src/adapters/browser-image"
import { FaceDetectionError } from "../src/adapters/mediapipe"

describe("scaledDecodeSize", () => {
  it("keeps photos at or below the display cap untouched", () => {
    expect(scaledDecodeSize(2048, 1536)).toBeNull()
    expect(scaledDecodeSize(384, 480)).toBeNull()
  })

  it("caps a 24MP DSLR original to the display edge while keeping aspect", () => {
    const scaled = scaledDecodeSize(6000, 4000)
    expect(scaled).toEqual({ width: DISPLAY_MAX_EDGE, height: 1365 })

    const portrait = scaledDecodeSize(4000, 6000)
    expect(portrait).toEqual({ width: 1365, height: DISPLAY_MAX_EDGE })
  })

  it("keeps the export quality relation: the cap covers the largest export target", () => {
    // 개별 PNG 내보내기(800×1000)가 최대 타깃이므로 축소본에서 업스케일이 없어야 한다.
    expect(DISPLAY_MAX_EDGE).toBeGreaterThanOrEqual(2 * 1000)
  })
})

describe("classifyPhotoError", () => {
  it("separates decode, missing-face, and unexpected analysis failures", () => {
    expect(classifyPhotoError(new ImageDecodeError())).toBe("decode_failed")
    expect(classifyPhotoError(new FaceDetectionError("no_face"))).toBe("face_not_detected")
    expect(classifyPhotoError(new Error("model failed"))).toBe("analysis_failed")
  })
})
