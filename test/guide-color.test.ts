// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import {
  applyGuideColor,
  DEFAULT_GUIDE_COLOR,
  GUIDE_COLOR_STORAGE_KEY,
  GUIDE_COLORS,
  isGuideColorId,
  readStoredGuideColor,
} from "../src/product/guide-color"

describe("guide color setting", () => {
  it("offers five distinct colors with magenta as the default", () => {
    // 기본 마젠타: 시안 UI·피부톤 어느 쪽과도 겹치지 않아 가장 눈에 띈다(2026-09-03).
    expect(GUIDE_COLORS.map((option) => option.id)).toEqual([
      "magenta",
      "cyan",
      "lime",
      "yellow",
      "white",
    ])
    expect(new Set(GUIDE_COLORS.map((option) => option.value)).size).toBe(5)
    expect(DEFAULT_GUIDE_COLOR).toBe("magenta")
    expect(isGuideColorId("lime")).toBe(true)
    expect(isGuideColorId("purple")).toBe(false)
    expect(isGuideColorId(null)).toBe(false)
  })

  it("falls back to the default for missing, unknown, or unreadable storage", () => {
    expect(readStoredGuideColor(null)).toBe("magenta")
    expect(readStoredGuideColor({ getItem: () => null })).toBe("magenta")
    expect(readStoredGuideColor({ getItem: () => "purple" })).toBe("magenta")
    expect(
      readStoredGuideColor({
        getItem: () => {
          throw new Error("blocked")
        },
      }),
    ).toBe("magenta")
    expect(
      readStoredGuideColor({
        getItem: (key) => (key === GUIDE_COLOR_STORAGE_KEY ? "yellow" : null),
      }),
    ).toBe("yellow")
  })

  it("applies the choice as a root data attribute that the CSS maps to --guide-color", () => {
    const root = document.createElement("html")
    applyGuideColor(root, "lime")
    expect(root.dataset["guideColor"]).toBe("lime")
  })
})
