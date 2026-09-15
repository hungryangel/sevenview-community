import { describe, expect, it } from "vitest"

import {
  COMPARISON_ANGLES,
  COMPARISON_SIDES,
  COMPARISON_VIEW_MODES,
  isComparisonPairReady,
} from "../src/domain/comparison"

describe("comparison domain contract", () => {
  it("exposes exactly the two semantic sides, three modes, and five shared angles", () => {
    expect(COMPARISON_SIDES).toEqual(["before", "after"])
    expect(COMPARISON_VIEW_MODES).toEqual(["sideBySide", "wipe", "toggle"])
    expect(COMPARISON_ANGLES).toEqual([
      "front",
      "rightOblique",
      "leftOblique",
      "rightProfile",
      "leftProfile",
    ])
  })

  it("requires both fixed slots before a pair is ready", () => {
    expect(isComparisonPairReady({ before: { id: "a" }, after: { id: "b" } })).toBe(true)
    expect(isComparisonPairReady({ before: { id: "a" }, after: null })).toBe(false)
    expect(isComparisonPairReady({ before: null, after: { id: "b" } })).toBe(false)
  })
})
