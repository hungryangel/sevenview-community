import { describe, expect, it } from "vitest"

import {
  DEFAULT_FRAMING_PRESET_ID,
  FRAMING_PRESETS,
  STANDARD_SEVEN_VIEW_DRAFT,
} from "../src/domain/protocol-preset"
import { VIEW_IDS } from "../src/domain/types"

describe("Standard 7 View draft preset", () => {
  it("keeps the publishable preset as structured data instead of a hospital-specific setting", () => {
    expect(STANDARD_SEVEN_VIEW_DRAFT).toEqual({
      aspectRatio: "4:5",
      draft: true,
      labels: expect.any(Object),
      lateralityConvention: "patient",
      name: "Standard 7 View (초안)",
      viewOrder: VIEW_IDS,
    })
    expect(Object.keys(STANDARD_SEVEN_VIEW_DRAFT.labels)).toEqual(VIEW_IDS)
  })

  it("ships two framing presets with the clinical standard as the default", () => {
    // 2026-09-02 소유자 결정(2안): 기본=임상 표준, 클로즈업은 선택지로 유지.
    expect(DEFAULT_FRAMING_PRESET_ID).toBe("clinicalStandard")
    for (const preset of Object.values(FRAMING_PRESETS)) {
      expect(Object.keys(preset.views)).toEqual(VIEW_IDS)
      for (const framing of Object.values(preset.views)) {
        expect(framing.faceRatio).toBeGreaterThan(0)
        expect(framing.faceRatio).toBeLessThan(1)
      }
    }
    // 표준은 클로즈업보다 얼굴을 작게(넓은 범위를) 담는다.
    expect(FRAMING_PRESETS.clinicalStandard.views.front.faceRatio).toBeLessThan(
      FRAMING_PRESETS.closeUp.views.front.faceRatio,
    )
    // 턱밑·정수리는 이마~턱이 원근으로 줄어드는 뷰라 배율 기준이 얼굴 폭이다.
    expect(FRAMING_PRESETS.clinicalStandard.views.chinUp.faceExtent).toBe("width")
    expect(FRAMING_PRESETS.clinicalStandard.views.crownDown.faceExtent).toBe("width")
    expect(FRAMING_PRESETS.clinicalStandard.views.front.faceExtent).toBe("height")
  })
})
