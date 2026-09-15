import { describe, expect, it, vi } from "vitest"
import {
  ComparisonCanvasError,
  type ComparisonDrawingContext,
  type ComparisonExportDependencies,
  type ComparisonExportImage,
  type ComparisonExportPair,
  drawComparisonImage,
  exportComparisonPng,
} from "../src/adapters/comparison-canvas"
import { EyePrivacyRasterError } from "../src/adapters/eye-mosaic"

type ComparisonInstructionIsRequired =
  undefined extends ComparisonExportImage<string>["instruction"] ? false : true

const COMPARISON_INSTRUCTION_IS_REQUIRED: ComparisonInstructionIsRequired = true

const instruction = {
  rotationDegrees: 0,
  scale: 0.94,
  sourceAnchor: { x: 400, y: 400 },
  targetAnchor: { x: 376, y: 376 },
  targetSize: { height: 940, width: 752 },
}

const pair: ComparisonExportPair<string> = {
  before: {
    image: "before-image",
    instruction,
    privacy: { enabled: false },
  },
  after: {
    image: "after-image",
    instruction,
    privacy: { enabled: false },
  },
}

function drawingSpy(): {
  readonly context: ComparisonDrawingContext<string>
  readonly events: string[]
} {
  const events: string[] = []
  return {
    events,
    context: {
      imageSmoothingEnabled: true,
      fillStyle: "",
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
      beginPath: () => events.push("begin"),
      clip: () => events.push("clip"),
      drawImage: (image) => events.push(`draw:${image}`),
      fillRect: (x, y, width, height) => events.push(`fill:${x}:${y}:${width}:${height}`),
      fillText: (value, x, y) => events.push(`text:${value}:${x}:${y}`),
      rect: (x, y, width, height) => events.push(`rect:${x}:${y}:${width}:${height}`),
      restore: () => events.push("restore"),
      rotate: () => events.push("rotate"),
      save: () => events.push("save"),
      scale: () => events.push("scale"),
      translate: (x, y) => events.push(`translate:${x}:${y}`),
    },
  }
}

function exportDependencies(
  toBlob: HTMLCanvasElement["toBlob"],
  click: () => void = () => undefined,
): {
  readonly dependencies: ComparisonExportDependencies<string>
  readonly createCanvas: ReturnType<typeof vi.fn>
  readonly createObjectUrl: ReturnType<typeof vi.fn>
  readonly revokeObjectUrl: ReturnType<typeof vi.fn>
  readonly anchor: { download: string; href: string; click: () => void }
} {
  const { context } = drawingSpy()
  const createCanvas = vi.fn((width: number, height: number) => ({
    context,
    height,
    toBlob,
    width,
  }))
  const createObjectUrl = vi.fn(() => "blob:comparison")
  const revokeObjectUrl = vi.fn()
  const anchor = { download: "", href: "", click: vi.fn(click) }
  return {
    anchor,
    createCanvas,
    createObjectUrl,
    revokeObjectUrl,
    dependencies: {
      createCanvas,
      createDownloadAnchor: () => anchor,
      createObjectUrl,
      revokeObjectUrl,
    },
  }
}

describe("comparison canvas", () => {
  it("requires each exported image to carry the shared render-model instruction", () => {
    expect(COMPARISON_INSTRUCTION_IS_REQUIRED).toBe(true)
  })

  it("draws two clipped 752 by 940 frames and exact bottom labels", () => {
    const { context, events } = drawingSpy()
    drawComparisonImage(context, pair)

    expect(events).toContain("fill:0:0:1600:1000")
    expect(events.filter((event) => event === "rect:0:0:752:940")).toHaveLength(2)
    expect(events.filter((event) => event === "clip")).toHaveLength(2)
    expect(events).toContain("translate:36:20")
    expect(events).toContain("translate:812:20")
    expect(events.filter((event) => event.startsWith("draw:"))).toEqual([
      "draw:before-image",
      "draw:after-image",
    ])
    expect(events).toContain("text:시술 전:412:980")
    expect(events).toContain("text:시술 후:1188:980")
    expect(events.indexOf("clip")).toBeLessThan(events.indexOf("draw:before-image"))
  })

  it("encodes a fresh PNG and performs one named download with URL revocation", async () => {
    const fixture = exportDependencies((callback, type) =>
      callback(new Blob(["fresh pixels"], { type: type ?? "" })),
    )
    await exportComparisonPng(pair, "comparison.png", fixture.dependencies)

    expect(fixture.createCanvas).toHaveBeenCalledWith(1600, 1000)
    expect(fixture.createObjectUrl).toHaveBeenCalledTimes(1)
    expect(fixture.anchor).toMatchObject({ download: "comparison.png", href: "blob:comparison" })
    expect(fixture.anchor.click).toHaveBeenCalledTimes(1)
    expect(fixture.revokeObjectUrl).toHaveBeenCalledWith("blob:comparison")
  })

  it("keeps semantic captions attached to photos when the order is reversed", () => {
    // Given: the same before and after pair.
    const { context, events } = drawingSpy()
    // When: the after photo is placed first.
    drawComparisonImage(context, pair, "afterBefore")
    // Then: photo positions and their captions move together.
    expect(events.filter((event) => event.startsWith("draw:"))).toEqual([
      "draw:after-image",
      "draw:before-image",
    ])
    expect(events.filter((event) => event.startsWith("text:"))).toEqual([
      "text:시술 후:412:980",
      "text:시술 전:1188:980",
    ])
  })

  it("renders reviewed privacy masks in both frames and fails closed before an incomplete export", () => {
    const reviewed = {
      provenance: "manual" as const,
      regions: [{ left: 0.25, top: 0.3, right: 0.75, bottom: 0.5 }],
    }
    const privatePair: ComparisonExportPair<string> = {
      before: {
        ...pair.before,
        privacy: { enabled: true, mask: reviewed, sourceSize: { width: 800, height: 1000 } },
      },
      after: {
        ...pair.after,
        privacy: { enabled: true, mask: reviewed, sourceSize: { width: 800, height: 1000 } },
      },
    }
    const rendered = drawingSpy()
    drawComparisonImage(rendered.context, privatePair)
    expect(rendered.events.filter((event) => event === "draw:before-image").length).toBeGreaterThan(
      10,
    )
    expect(rendered.events.filter((event) => event === "draw:after-image").length).toBeGreaterThan(
      10,
    )

    const incomplete: ComparisonExportPair<string> = {
      ...privatePair,
      after: {
        ...privatePair.after,
        privacy: { enabled: true, mask: null, sourceSize: { width: 800, height: 1000 } },
      },
    }
    expect(() => drawComparisonImage(drawingSpy().context, incomplete)).toThrow(
      EyePrivacyRasterError,
    )
  })

  it("rejects a null PNG encoding without creating a download", async () => {
    const fixture = exportDependencies((callback) => callback(null))
    await expect(
      exportComparisonPng(pair, "comparison.png", fixture.dependencies),
    ).rejects.toBeInstanceOf(ComparisonCanvasError)
    expect(fixture.createObjectUrl).not.toHaveBeenCalled()
  })

  it("revokes the object URL when the download click throws", async () => {
    const fixture = exportDependencies(
      (callback) => callback(new Blob(["pixels"], { type: "image/png" })),
      () => {
        throw new ComparisonCanvasError("download blocked")
      },
    )
    await expect(exportComparisonPng(pair, "comparison.png", fixture.dependencies)).rejects.toThrow(
      "download blocked",
    )
    expect(fixture.revokeObjectUrl).toHaveBeenCalledWith("blob:comparison")
  })
})
