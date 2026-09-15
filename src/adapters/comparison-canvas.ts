import {
  COMPARISON_EXPORT_LABELS,
  COMPARISON_EXPORT_SLOTS,
  type ComparisonExportOrder,
} from "../domain/comparison-export"
import type { EyePrivacyRaster } from "../domain/comparison-eye-privacy"
import { EXPORT_RENDER_STYLE } from "../domain/export-render-style"
import { buildComparisonFilename } from "../domain/session-export"
import type { CropInstruction } from "../domain/types"
import type { DrawingContext } from "./canvas"
import { drawPrivacyCroppedImage, type EyePrivacyDrawingContext } from "./eye-mosaic"

export const COMPARISON_SHEET = {
  frameHeight: 940,
  frameWidth: 752,
  frameY: 20,
  height: 1000,
  labelCenterY: 980,
  width: 1600,
} as const

export const COMPARISON_FRAMES = [{ x: 36 }, { x: 812 }] as const

export type ComparisonExportImage<TImage> = {
  readonly image: TImage
  readonly instruction: CropInstruction
  readonly privacy: EyePrivacyRaster
}

export type ComparisonExportPair<TImage> = {
  readonly after: ComparisonExportImage<TImage>
  readonly before: ComparisonExportImage<TImage>
}

export type ComparisonDrawingContext<TImage> = DrawingContext<TImage> &
  EyePrivacyDrawingContext<TImage> & {
    font: string
    textAlign: CanvasTextAlign
    textBaseline: CanvasTextBaseline
    beginPath(): void
    clip(): void
    fillText(value: string, x: number, y: number): void
    rect(x: number, y: number, width: number, height: number): void
  }

export type ComparisonExportCanvas<TImage> = {
  readonly context: ComparisonDrawingContext<TImage>
  readonly height: number
  readonly toBlob: HTMLCanvasElement["toBlob"]
  readonly width: number
}

export type ComparisonDownloadAnchor = {
  download: string
  href: string
  click(): void
}

export type ComparisonExportDependencies<TImage> = {
  readonly createCanvas: (width: number, height: number) => ComparisonExportCanvas<TImage>
  readonly createDownloadAnchor: () => ComparisonDownloadAnchor
  readonly createObjectUrl: (blob: Blob) => string
  readonly revokeObjectUrl: (url: string) => void
}

export class ComparisonCanvasError extends Error {
  readonly name = "ComparisonCanvasError"
}

export function drawComparisonImage<TImage>(
  context: ComparisonDrawingContext<TImage>,
  pair: ComparisonExportPair<TImage>,
  order: ComparisonExportOrder = "beforeAfter",
): void {
  context.fillStyle = EXPORT_RENDER_STYLE.background
  context.fillRect(0, 0, COMPARISON_SHEET.width, COMPARISON_SHEET.height)
  const slots = COMPARISON_EXPORT_SLOTS[order]
  for (const [index, frame] of COMPARISON_FRAMES.entries()) {
    const slot = slots[index]
    if (slot === undefined) {
      throw new ComparisonCanvasError(`Comparison frame is missing: ${index}`)
    }
    const image = pair[slot]
    context.save()
    context.translate(frame.x, COMPARISON_SHEET.frameY)
    context.beginPath()
    context.rect(0, 0, COMPARISON_SHEET.frameWidth, COMPARISON_SHEET.frameHeight)
    context.clip()
    drawPrivacyCroppedImage(context, image.image, image.instruction, image.privacy)
    context.restore()
  }
  context.fillStyle = EXPORT_RENDER_STYLE.ink
  context.font = EXPORT_RENDER_STYLE.labelFont
  context.textAlign = "center"
  context.textBaseline = "middle"
  for (const [index, frame] of COMPARISON_FRAMES.entries()) {
    const slot = slots[index]
    if (slot === undefined) {
      throw new ComparisonCanvasError(`Comparison label is missing: ${index}`)
    }
    context.fillText(
      COMPARISON_EXPORT_LABELS[slot],
      frame.x + COMPARISON_SHEET.frameWidth / 2,
      COMPARISON_SHEET.labelCenterY,
    )
  }
}

export async function exportComparisonPng<TImage>(
  pair: ComparisonExportPair<TImage>,
  filename: string,
  dependencies: ComparisonExportDependencies<TImage>,
  shouldDownload: () => boolean = () => true,
): Promise<"downloaded" | "stale"> {
  const canvas = dependencies.createCanvas(COMPARISON_SHEET.width, COMPARISON_SHEET.height)
  drawComparisonImage(canvas.context, pair)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((encoded) => {
      if (encoded === null) {
        reject(new ComparisonCanvasError("PNG encoding failed"))
        return
      }
      resolve(encoded)
    }, "image/png")
  })
  if (!shouldDownload()) return "stale"
  downloadComparisonBlob(blob, filename, dependencies)
  return "downloaded"
}

export function downloadComparisonBlob<TImage>(
  blob: Blob,
  filename: string,
  dependencies: ComparisonExportDependencies<TImage>,
): void {
  const url = dependencies.createObjectUrl(blob)
  try {
    const anchor = dependencies.createDownloadAnchor()
    anchor.download = filename
    anchor.href = url
    anchor.click()
  } finally {
    dependencies.revokeObjectUrl(url)
  }
}

export const BROWSER_COMPARISON_EXPORT_DEPENDENCIES: ComparisonExportDependencies<CanvasImageSource> =
  {
    createCanvas: (width, height) => {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")
      if (context === null) {
        throw new ComparisonCanvasError("Canvas is unavailable")
      }
      return {
        context,
        height,
        toBlob: canvas.toBlob.bind(canvas),
        width,
      }
    },
    createDownloadAnchor: () => document.createElement("a"),
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  }

export function exportBrowserComparisonPng(
  pair: ComparisonExportPair<CanvasImageSource>,
  now: Date = new Date(),
  shouldDownload: () => boolean = () => true,
): Promise<"downloaded" | "stale"> {
  return exportComparisonPng(
    pair,
    buildComparisonFilename(now),
    BROWSER_COMPARISON_EXPORT_DEPENDENCIES,
    shouldDownload,
  )
}
