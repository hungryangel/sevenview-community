import { describe, expect, it } from "vitest"
import { drawEyeMosaicInFrame, drawEyeMosaicInSource } from "../src/adapters/eye-mosaic"
import type { EyePrivacyMask } from "../src/domain/comparison-eye-privacy"

const mask: EyePrivacyMask = {
  provenance: "manual",
  regions: [{ left: 0.25, top: 0.3, right: 0.75, bottom: 0.5 }],
}

describe("eye mosaic raster", () => {
  it("samples the original inside the reviewed source rectangle without changing it", () => {
    const draws: number[][] = []
    const context = {
      imageSmoothingEnabled: true,
      drawImage: (_image: string, ...coordinates: number[]) => draws.push(coordinates),
    }

    drawEyeMosaicInSource(context, "original", { width: 800, height: 1000 }, mask)

    expect(context.imageSmoothingEnabled).toBe(true)
    expect(draws.length).toBeGreaterThan(8)
    expect(draws.every((coordinates) => coordinates.length === 8)).toBe(true)
    expect(
      draws.every((coordinates) => {
        const sourceX = coordinates[0]
        const sourceY = coordinates[1]
        return sourceX !== undefined && sourceY !== undefined && sourceX >= 200 && sourceY >= 300
      }),
    ).toBe(true)
    expect(draws.every((coordinates) => coordinates.every(Number.isFinite))).toBe(true)
  })

  it("fails closed for invalid source dimensions", () => {
    expect(() =>
      drawEyeMosaicInSource(
        { imageSmoothingEnabled: true, drawImage: () => undefined },
        "original",
        { width: 0, height: 1000 },
        mask,
      ),
    ).toThrow("Eye mask source is invalid")
  })

  it("keeps frame mosaic samples inside the source at the lower-right edge", () => {
    const draws: number[][] = []
    drawEyeMosaicInFrame(
      {
        imageSmoothingEnabled: true,
        drawImage: (_image: string, ...coordinates: number[]) => draws.push(coordinates),
      },
      "original",
      { width: 7, height: 5 },
      { x: 10, y: 20, width: 70, height: 50 },
      {
        provenance: "manual",
        regions: [{ left: 0.8, top: 0.8, right: 1, bottom: 1 }],
      },
    )

    expect(draws.length).toBeGreaterThan(0)
    expect(
      draws.every(([sourceX, sourceY]) =>
        sourceX !== undefined && sourceY !== undefined
          ? sourceX >= 0 && sourceX < 7 && sourceY >= 0 && sourceY < 5
          : false,
      ),
    ).toBe(true)
  })
})
