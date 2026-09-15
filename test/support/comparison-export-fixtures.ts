import { vi } from "vitest"
import type {
  ComparisonExportDependencies,
  ComparisonExportPair,
} from "../../src/adapters/comparison-canvas"

const instruction = {
  rotationDegrees: 7,
  scale: 0.94,
  sourceAnchor: { x: 400, y: 420 },
  targetAnchor: { x: 376, y: 400 },
  targetSize: { height: 940, width: 752 },
} as const

export const comparisonExportPair: ComparisonExportPair<string> = {
  before: { image: "before-pixels", instruction, privacy: { enabled: false } },
  after: {
    image: "after-pixels",
    instruction: { ...instruction, rotationDegrees: -3 },
    privacy: { enabled: false },
  },
}

export function comparisonExportFixture(
  options: {
    readonly encodingFailsAt?: number
    readonly click?: () => void
    readonly createDownloadAnchor?: ComparisonExportDependencies<string>["createDownloadAnchor"]
  } = {},
) {
  const canvases: { readonly width: number; readonly height: number; readonly events: string[] }[] =
    []
  const blobs: Blob[] = []
  let encodingCount = 0
  const anchor = { download: "", href: "", click: vi.fn(options.click) }
  const revokeObjectUrl = vi.fn()
  const dependencies: ComparisonExportDependencies<string> = {
    createCanvas: (width, height) => {
      const events: string[] = []
      canvases.push({ width, height, events })
      return {
        height,
        width,
        toBlob: (callback, type) => {
          encodingCount += 1
          callback(
            options.encodingFailsAt === encodingCount
              ? null
              : new Blob([JSON.stringify({ width, height, events })], {
                  type: type ?? "image/png",
                }),
          )
        },
        context: {
          fillStyle: "",
          font: "",
          textAlign: "start",
          textBaseline: "alphabetic",
          beginPath: () => events.push("begin"),
          clip: () => events.push("clip"),
          drawImage: (image) => events.push(`image:${image}`),
          fillRect: (x, y, w, h) => events.push(`fill:${x}:${y}:${w}:${h}`),
          fillText: (text, x, y) => events.push(`text:${text}:${x}:${y}`),
          rect: (x, y, w, h) => events.push(`rect:${x}:${y}:${w}:${h}`),
          restore: () => events.push("restore"),
          rotate: (radians) => events.push(`rotate:${radians}`),
          save: () => events.push("save"),
          scale: (x, y) => events.push(`scale:${x}:${y}`),
          translate: (x, y) => events.push(`translate:${x}:${y}`),
        },
      }
    },
    createDownloadAnchor: options.createDownloadAnchor ?? (() => anchor),
    createObjectUrl: (blob) => {
      blobs.push(blob)
      return "blob:comparison-export"
    },
    revokeObjectUrl,
  }
  return {
    dependencies,
    canvases,
    blobs,
    anchor,
    revokeObjectUrl,
    getEncodingCount: () => encodingCount,
  }
}

export function zipEntries(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = new Map<string, Uint8Array>()
  let offset = 0
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const contentOffset = offset + 30 + nameLength + extraLength
    entries.set(
      new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength)),
      bytes.subarray(contentOffset, contentOffset + size),
    )
    offset = contentOffset + size
  }
  return entries
}

export function requiredBlob(blobs: readonly Blob[]): Blob {
  const blob = blobs[0]
  if (blob === undefined) throw new TypeError("Expected a downloaded artifact")
  return blob
}
