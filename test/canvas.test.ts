import { describe, expect, it } from "vitest"

import { drawCroppedImage } from "../src/adapters/canvas"

describe("drawCroppedImage", () => {
  it("applies the pure render plan in canvas transform order", () => {
    // Given: an instrumented drawing boundary and a known crop.
    const events: string[] = []
    const context = {
      fillStyle: "",
      drawImage: (image: string, x: number, y: number) => events.push(`draw:${image}:${x}:${y}`),
      fillRect: (x: number, y: number, width: number, height: number) =>
        events.push(`fill:${x}:${y}:${width}:${height}`),
      restore: () => events.push("restore"),
      rotate: (radians: number) => events.push(`rotate:${radians.toFixed(3)}`),
      save: () => events.push("save"),
      scale: (x: number, y: number) => events.push(`scale:${x}:${y}`),
      translate: (x: number, y: number) => events.push(`translate:${x}:${y}`),
    }

    // When: the crop is rendered.
    drawCroppedImage(context, "photo", {
      sourceAnchor: { x: 400, y: 500 },
      targetAnchor: { x: 200, y: 240 },
      targetSize: { width: 400, height: 500 },
      scale: 0.5,
      rotationDegrees: -6,
    })

    // Then: background and transforms precede the original image draw.
    expect(context.fillStyle).toBe("#f4f4f2")
    expect(events).toEqual([
      "save",
      "fill:0:0:400:500",
      "translate:200:240",
      "rotate:-0.105",
      "scale:0.5:0.5",
      "translate:-400:-500",
      "draw:photo:0:0",
      "restore",
    ])
  })
})
