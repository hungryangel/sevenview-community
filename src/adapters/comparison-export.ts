import {
  buildComparisonArtifactFilename,
  buildComparisonExportFilename,
  buildComparisonIndividualFilename,
  COMPARISON_EXPORT_LABELS,
  COMPARISON_EXPORT_SLOTS,
  type ComparisonExportSettings,
  hasComparisonExportOutput,
} from "../domain/comparison-export"
import { EXPORT_RENDER_STYLE } from "../domain/export-render-style"
import {
  BROWSER_COMPARISON_EXPORT_DEPENDENCIES,
  COMPARISON_FRAMES,
  COMPARISON_SHEET,
  ComparisonCanvasError,
  type ComparisonExportDependencies,
  type ComparisonExportPair,
  downloadComparisonBlob,
  drawComparisonImage,
} from "./comparison-canvas"
import {
  buildComparisonHtml,
  COMPARISON_HTML_MIME_TYPE,
  type ComparisonHtmlImage,
} from "./comparison-html"
import { encodeCanvasJpeg, encodeCanvasPng } from "./contact-sheet-canvas"
import { drawPrivacyCroppedImage } from "./eye-mosaic"
import { buildSinglePagePdf } from "./pdf-store"
import { buildContactSheetPptx, PPTX_MIME_TYPE, type PptxSheetTile } from "./pptx-store"
import { buildZipStore, type ZipEntry } from "./zip-store"

type ComparisonExportArtifact = ZipEntry & { readonly type: string }

export async function exportComparison<TImage>(
  pair: ComparisonExportPair<TImage>,
  settings: ComparisonExportSettings,
  dependencies: ComparisonExportDependencies<TImage>,
  shouldDownload: () => boolean = () => true,
): Promise<"downloaded" | "stale"> {
  const { selection, sessionName } = settings
  if (!hasComparisonExportOutput(selection)) {
    throw new ComparisonCanvasError("Choose at least one comparison export")
  }
  const artifacts: ComparisonExportArtifact[] = []
  if (selection.png || selection.pdf) {
    const canvas = dependencies.createCanvas(COMPARISON_SHEET.width, COMPARISON_SHEET.height)
    drawComparisonImage(canvas.context, pair, settings.order)
    if (selection.png) {
      artifacts.push({
        name: buildComparisonArtifactFilename(sessionName, "png"),
        data: new Uint8Array(await (await encodeCanvasPng(canvas)).arrayBuffer()),
        type: "image/png",
      })
    }
    if (selection.pdf) {
      artifacts.push({
        name: buildComparisonArtifactFilename(sessionName, "pdf"),
        data: buildSinglePagePdf({
          imageWidthPx: COMPARISON_SHEET.width,
          imageHeightPx: COMPARISON_SHEET.height,
          jpegBytes: new Uint8Array(await (await encodeCanvasJpeg(canvas)).arrayBuffer()),
        }),
        type: "application/pdf",
      })
    }
  }

  const tiles: PptxSheetTile[] = []
  const htmlImages: ComparisonHtmlImage[] = []
  if (selection.individualPngs || selection.pptx || selection.html) {
    for (const [index, slot] of COMPARISON_EXPORT_SLOTS[settings.order].entries()) {
      const image = pair[slot]
      const canvas = dependencies.createCanvas(
        COMPARISON_SHEET.frameWidth,
        COMPARISON_SHEET.frameHeight,
      )
      drawPrivacyCroppedImage(canvas.context, image.image, image.instruction, image.privacy)
      if (selection.individualPngs || selection.html) {
        const png = new Uint8Array(await (await encodeCanvasPng(canvas)).arrayBuffer())
        if (selection.individualPngs) {
          artifacts.push({
            name: buildComparisonIndividualFilename(settings, slot),
            data: png,
            type: "image/png",
          })
        }
        if (selection.html) htmlImages.push({ slot, png })
      }
      if (selection.pptx) {
        const frame = COMPARISON_FRAMES[index]
        if (frame === undefined) {
          throw new ComparisonCanvasError(`Comparison frame is missing: ${index}`)
        }
        tiles.push({
          frame: {
            x: frame.x,
            y: COMPARISON_SHEET.frameY,
            width: COMPARISON_SHEET.frameWidth,
            height: COMPARISON_SHEET.frameHeight,
          },
          jpegBytes: new Uint8Array(await (await encodeCanvasJpeg(canvas)).arrayBuffer()),
          label: COMPARISON_EXPORT_LABELS[slot],
          labelFrame: {
            x: frame.x,
            y: COMPARISON_SHEET.frameY + COMPARISON_SHEET.frameHeight,
            width: COMPARISON_SHEET.frameWidth,
            height:
              COMPARISON_SHEET.height - COMPARISON_SHEET.frameY - COMPARISON_SHEET.frameHeight,
          },
        })
      }
    }
  }
  if (selection.pptx) {
    artifacts.push({
      name: buildComparisonArtifactFilename(sessionName, "pptx"),
      data: buildContactSheetPptx({
        background: EXPORT_RENDER_STYLE.background,
        inkColor: EXPORT_RENDER_STYLE.ink,
        sheet: COMPARISON_SHEET,
        tiles,
        footerFrame: { x: 0, y: COMPARISON_SHEET.height, width: COMPARISON_SHEET.width, height: 0 },
      }),
      type: PPTX_MIME_TYPE,
    })
  }
  if (selection.html) {
    const first = htmlImages[0]
    const second = htmlImages[1]
    if (first === undefined || second === undefined) {
      throw new ComparisonCanvasError("Comparison HTML images are missing")
    }
    artifacts.push({
      name: buildComparisonArtifactFilename(sessionName, "html"),
      data: buildComparisonHtml([first, second]),
      type: COMPARISON_HTML_MIME_TYPE,
    })
  }
  const single = artifacts.length === 1 ? artifacts[0] : undefined
  const data = single?.data ?? buildZipStore(artifacts)
  if (!shouldDownload()) return "stale"
  downloadComparisonBlob(
    new Blob([new Uint8Array(data)], { type: single?.type ?? "application/zip" }),
    buildComparisonExportFilename(settings),
    dependencies,
  )
  return "downloaded"
}

export function exportBrowserComparison(
  pair: ComparisonExportPair<CanvasImageSource>,
  settings: ComparisonExportSettings,
  shouldDownload: () => boolean,
): Promise<"downloaded" | "stale"> {
  return exportComparison(pair, settings, BROWSER_COMPARISON_EXPORT_DEPENDENCIES, shouldDownload)
}
