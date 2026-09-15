import { describe, expect, it } from "vitest"

import { buildContactSheetLayout } from "../src/domain/contact-sheet"

describe("buildContactSheetLayout", () => {
  it("centers the final three tiles beneath the first four", () => {
    // Given: the canonical 2400 by 1600 conference sheet.
    const sheet = {
      width: 2400,
      height: 1600,
      margin: 64,
      gap: 24,
      labelHeight: 48,
    }

    // When: seven tiles are laid out in two rows.
    const result = buildContactSheetLayout(sheet)

    // Then: four tiles occupy row one and three are centered in row two.
    expect(result).toHaveLength(7)
    expect(result.slice(0, 4).every((tile) => tile.row === 0)).toBe(true)
    expect(result.slice(4).every((tile) => tile.row === 1)).toBe(true)
    expect(result[4]?.x).toBeGreaterThan(result[0]?.x ?? Number.POSITIVE_INFINITY)
    expect(result[6]?.right).toBeLessThan(result[3]?.right ?? Number.NEGATIVE_INFINITY)
  })

  it("keeps every portrait frame inside the configured margins", () => {
    // Given: a seven-tile sheet.
    const sheet = {
      width: 2400,
      height: 1600,
      margin: 64,
      gap: 24,
      labelHeight: 48,
    }

    // When: tile rectangles are computed.
    const result = buildContactSheetLayout(sheet)

    // Then: every rectangle remains inside the export canvas.
    expect(result.every((tile) => tile.x >= 64 && tile.y >= 64)).toBe(true)
    expect(result.every((tile) => tile.right <= 2336 && tile.bottom <= 1536)).toBe(true)
  })
})
