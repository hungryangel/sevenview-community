// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import {
  applyGuideWidth,
  DEFAULT_GUIDE_WIDTH,
  GUIDE_WIDTH_STORAGE_KEY,
  GUIDE_WIDTHS,
  isGuideWidthId,
  readStoredGuideWidth,
} from "../src/product/guide-width"

describe("guide width setting", () => {
  it("offers three widths with 2px as the default", () => {
    // 2026-09-03 bee 제안: 기준선 두께도 설정에서 고른다.
    expect(GUIDE_WIDTHS.map((option) => [option.id, option.px])).toEqual([
      ["thin", 1],
      ["regular", 2],
      ["bold", 3],
    ])
    expect(DEFAULT_GUIDE_WIDTH).toBe("regular")
    expect(isGuideWidthId("bold")).toBe(true)
    expect(isGuideWidthId("hairline")).toBe(false)
  })

  it("falls back to the default for missing, unknown, or unreadable storage", () => {
    expect(readStoredGuideWidth(null)).toBe("regular")
    expect(readStoredGuideWidth({ getItem: () => "hairline" })).toBe("regular")
    expect(
      readStoredGuideWidth({
        getItem: () => {
          throw new Error("blocked")
        },
      }),
    ).toBe("regular")
    expect(
      readStoredGuideWidth({ getItem: (key) => (key === GUIDE_WIDTH_STORAGE_KEY ? "thin" : null) }),
    ).toBe("thin")
  })

  it("applies the choice as a root data attribute that the CSS maps to --guide-width", () => {
    const root = document.createElement("html")
    applyGuideWidth(root, "bold")
    expect(root.dataset["guideWidth"]).toBe("bold")
  })
})
