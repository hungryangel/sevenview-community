import { describe, expect, it } from "vitest"

import { drawWorkspaceContactSheet, encodeCanvasPng } from "../src/adapters/contact-sheet-canvas"
import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { photoId, type SevenViewAssignment } from "../src/domain/types"
import { organizeWorkspacePhotos, type WorkspaceSourcePhoto } from "../src/domain/workspace"

const sources: readonly WorkspaceSourcePhoto<string>[] = Array.from({ length: 7 }, (_, index) => ({
  image: `image-${index + 1}`,
  pose: {
    id: photoId(`photo-${index + 1}`),
    yawScore: 0,
    pitchScore: 0,
    rollDegrees: 0,
    confidence: 0.9,
    bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
    anchor: { x: 0.5, y: 0.5 },
  },
  sourceSize: { width: 800, height: 1000 },
}))

const assignment: SevenViewAssignment = {
  front: photoId("photo-1"),
  rightOblique: photoId("photo-2"),
  leftOblique: photoId("photo-3"),
  rightProfile: photoId("photo-4"),
  leftProfile: photoId("photo-5"),
  chinUp: photoId("photo-6"),
  crownDown: photoId("photo-7"),
}

describe("drawWorkspaceContactSheet", () => {
  it("draws seven adjusted crops and Korean labels into a 4+3 sheet", () => {
    const events: string[] = []
    const context = {
      fillStyle: "",
      font: "",
      textAlign: "start" as CanvasTextAlign,
      textBaseline: "alphabetic" as CanvasTextBaseline,
      beginPath: () => events.push("beginPath"),
      clip: () => events.push("clip"),
      drawImage: (image: string) => events.push(`draw:${image}`),
      fillRect: (x: number, y: number, width: number, height: number) =>
        events.push(`fill:${x}:${y}:${width}:${height}`),
      fillText: (value: string) => events.push(`label:${value}`),
      rect: (x: number, y: number, width: number, height: number) =>
        events.push(`rect:${x}:${y}:${Math.round(width)}:${Math.round(height)}`),
      restore: () => events.push("restore"),
      rotate: () => events.push("rotate"),
      save: () => events.push("save"),
      scale: () => events.push("scale"),
      translate: () => events.push("translate"),
    }
    const photos = organizeWorkspacePhotos(sources, assignment)

    drawWorkspaceContactSheet(context, photos, FRAMING_PRESETS.clinicalStandard)

    expect(events.filter((event) => event.startsWith("draw:"))).toHaveLength(7)
    // 타일 클리핑 회귀 방지(2026-09-01 시트 파손): 사진마다 타일 크기의
    // clip이 draw보다 먼저 걸려야 한다.
    expect(events.filter((event) => event === "clip")).toHaveLength(7)
    expect(events.filter((event) => event.startsWith("rect:0:0:520:650"))).toHaveLength(7)
    const firstClip = events.indexOf("clip")
    const firstDraw = events.findIndex((event) => event.startsWith("draw:"))
    expect(firstClip).toBeGreaterThan(-1)
    expect(firstClip).toBeLessThan(firstDraw)
    expect(events.filter((event) => event.startsWith("label:"))).toEqual([
      "label:01 정면",
      "label:02 우측 45도",
      "label:03 좌측 45도",
      "label:04 우측 측면",
      "label:05 좌측 측면",
      "label:06 아래 (턱 밑)",
      "label:07 위 (정수리)",
    ])
    expect(events).toContain("fill:0:0:2400:1600")
  })

  it("re-encodes exports as PNG rather than copying source EXIF metadata", async () => {
    const requestedTypes: string[] = []
    const canvas = {
      toBlob: (callback: BlobCallback, type?: string) => {
        if (type !== undefined) {
          requestedTypes.push(type)
        }
        callback(new Blob(["new pixel data"], { type: type ?? "" }))
      },
    }

    await encodeCanvasPng(canvas)

    expect(requestedTypes).toEqual(["image/png"])
  })
})
