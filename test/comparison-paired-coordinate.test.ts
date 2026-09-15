import { describe, expect, it } from "vitest"
import { sourcePointFromClient } from "../src/product/comparison-paired-coordinate"

describe("paired source coordinate mapping", () => {
  it("maps through letterboxing and ignores its padding", () => {
    const bounds = { left: 10, top: 20, width: 200, height: 200 }
    expect(sourcePointFromClient({ x: 110, y: 120 }, bounds, { width: 200, height: 100 })).toEqual({
      x: 0.5,
      y: 0.5,
    })
    expect(sourcePointFromClient({ x: 110, y: 30 }, bounds, { width: 200, height: 100 })).toBeNull()
  })
})
