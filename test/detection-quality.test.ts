import { describe, expect, it } from "vitest"

import {
  DETECTION_QUALITY_LABELS,
  detectionQuality,
  isDetectionWeak,
} from "../src/domain/detection-quality"

describe("detectionQuality", () => {
  it("treats the measured legit sample values as non-weak in their own views", () => {
    // 2026-09-01 합성 7종 실측값 — 종전 단일 임계값(0.7)은 이 정상 세트의
    // 6/7 뷰를 "검토 필요"로 만들었다(양치기 경고).
    expect(detectionQuality("front", 0.81)).toBe("clear")
    expect(detectionQuality("rightOblique", 0.645)).toBe("clear")
    expect(detectionQuality("leftOblique", 0.66)).toBe("clear")
    expect(detectionQuality("rightProfile", 0.252)).toBe("clear")
    expect(detectionQuality("leftProfile", 0.362)).toBe("clear")
    expect(detectionQuality("chinUp", 0.694)).toBe("clear")
    expect(detectionQuality("crownDown", 0.536)).toBe("clear")
  })

  it("flags genuinely degraded detections relative to the view's expected band", () => {
    // 정면 기대 0.8의 절반 미만 = 흐림(작거나 흐릿한 얼굴).
    expect(isDetectionWeak("front", 0.3)).toBe(true)
    expect(detectionQuality("front", 0.5)).toBe("fair")
    // 측면은 기대값 자체가 낮으므로(0.25) 같은 절대값이라도 판정이 다르다.
    expect(isDetectionWeak("rightProfile", 0.3)).toBe(false)
    expect(isDetectionWeak("rightProfile", 0.1)).toBe(true)
  })

  it("keeps manual placeholders (confidence 0) weak in every view", () => {
    expect(isDetectionWeak("front", 0)).toBe(true)
    expect(isDetectionWeak("leftProfile", 0)).toBe(true)
  })

  it("labels the buckets in plain Korean", () => {
    expect(DETECTION_QUALITY_LABELS.clear).toBe("뚜렷함")
    expect(DETECTION_QUALITY_LABELS.fair).toBe("보통")
    expect(DETECTION_QUALITY_LABELS.weak).toBe("흐림")
  })
})
