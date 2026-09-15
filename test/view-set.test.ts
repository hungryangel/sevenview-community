import { describe, expect, it } from "vitest"

import { buildContactSheetLayout } from "../src/domain/contact-sheet"
import { VIEW_IDS } from "../src/domain/types"
import {
  DEFAULT_VIEW_SET_ID,
  isViewSetId,
  VIEW_SETS,
  viewSetIncludes,
} from "../src/domain/view-set"

describe("view sets", () => {
  it("keeps the plastic-surgery seven as the default and defines the dental six as data", () => {
    expect(DEFAULT_VIEW_SET_ID).toBe("standardSeven")
    expect(VIEW_SETS.standardSeven.views).toHaveLength(7)
    expect(VIEW_SETS.dentalSix.views).toEqual([
      "front",
      "frontSmile",
      "rightOblique",
      "leftOblique",
      "rightProfile",
      "leftProfile",
    ])
    expect(viewSetIncludes(VIEW_SETS.dentalSix, "chinUp")).toBe(false)
    expect(isViewSetId("dentalSix")).toBe(true)
    expect(isViewSetId("nope")).toBe(false)
  })

  it("only uses known view ids and sheet rows that add up to the view count", () => {
    for (const viewSet of Object.values(VIEW_SETS)) {
      for (const view of viewSet.views) {
        expect(VIEW_IDS).toContain(view)
      }
      expect(viewSet.sheetRows.reduce((sum, count) => sum + count, 0)).toBe(viewSet.views.length)
    }
  })

  it("lays a 3+3 sheet out as two centered rows of equal width", () => {
    const sheet = { width: 2400, height: 1600, margin: 64, gap: 32, labelHeight: 64 }
    const tiles = buildContactSheetLayout(sheet, [3, 3])
    expect(tiles).toHaveLength(6)
    expect(tiles.slice(0, 3).every((tile) => tile.row === 0)).toBe(true)
    expect(tiles.slice(3).every((tile) => tile.row === 1)).toBe(true)
    expect(tiles[0]?.x).toBe(tiles[3]?.x)
    expect(tiles.every((tile) => tile.right <= 2336 && tile.bottom <= 1536)).toBe(true)
    // 기본 [4, 3]은 예전 결과와 같다(7칸, 두 번째 줄이 가운데로 들어간다).
    const classic = buildContactSheetLayout(sheet)
    expect(classic).toHaveLength(7)
    expect(classic[4]?.x).toBeGreaterThan(classic[0]?.x ?? Number.POSITIVE_INFINITY)
  })
})
