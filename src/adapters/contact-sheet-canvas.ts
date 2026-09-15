import { buildContactSheetLayout } from "../domain/contact-sheet"
import { EXPORT_RENDER_STYLE } from "../domain/export-render-style"
import type { FramingPreset } from "../domain/protocol-preset"
import { VIEW_SETS, type ViewSet } from "../domain/view-set"
import type { WorkspacePhoto } from "../domain/workspace"
import { VIEW_LABELS } from "../domain/workspace"
import {
  buildWorkspaceRenderModel,
  workspaceRenderInstruction,
} from "../domain/workspace-render-model"
import { type DrawingContext, drawCroppedImage } from "./canvas"
import { buildSinglePagePdf } from "./pdf-store"
import { buildContactSheetPptx, PPTX_MIME_TYPE, type PptxSheetTile } from "./pptx-store"
import { buildZipStore } from "./zip-store"

const SHEET = {
  width: 2400,
  height: 1600,
  margin: 80,
  gap: 32,
  labelHeight: 54,
} as const

const INDIVIDUAL_VIEW_SIZE = {
  width: 800,
  height: 1000,
} as const

export type ContactSheetDrawingContext<TImage> = DrawingContext<TImage> & {
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  fillText(value: string, x: number, y: number): void
  beginPath(): void
  rect(x: number, y: number, width: number, height: number): void
  clip(): void
}

export class ContactSheetExportError extends Error {
  readonly name = "ContactSheetExportError"
}

export type ContactSheetDrawOptions = {
  readonly viewSet?: ViewSet
  readonly footer?: string
}

export type WorkspacePngExportOptions = {
  readonly contactSheet?: {
    readonly filename: string
    readonly footer: string
  }
  // 컨택트 시트를 PDF 한 페이지 / PPT 슬라이드 한 장으로(2026-09-03). footer는 시트와 공유.
  readonly contactSheetPdf?: { readonly filename: string }
  readonly contactSheetPptx?: { readonly filename: string }
  readonly sheetFooter?: string
  readonly framing: FramingPreset
  readonly viewSet?: ViewSet
  readonly individualPngs?: readonly string[]
  // 개별 PNG가 포함되면 필수 — 여러 파일은 ZIP 하나로 내려받는다(다중
  // 자동 다운로드 차단 회피). 컨택트 시트도 함께 선택되면 같은 ZIP에 담는다.
  readonly bundleFilename?: string
}

export type WorkspacePngExportResult = {
  readonly contactSheetExported: boolean
}

export function drawWorkspaceContactSheet<TImage>(
  context: ContactSheetDrawingContext<TImage>,
  photos: readonly WorkspacePhoto<TImage>[],
  framing: FramingPreset,
  options: ContactSheetDrawOptions = {},
): void {
  const viewSet = options.viewSet ?? VIEW_SETS.standardSeven
  if (photos.length < 1 || photos.length > viewSet.views.length) {
    throw new ContactSheetExportError("Between one and the set's view count photos are required")
  }

  const tiles = buildContactSheetLayout(SHEET, viewSet.sheetRows)
  context.fillStyle = EXPORT_RENDER_STYLE.background
  context.fillRect(0, 0, SHEET.width, SHEET.height)

  for (const [index, view] of viewSet.views.entries()) {
    const tile = tiles[index]
    if (tile === undefined) {
      throw new ContactSheetExportError(`Contact sheet tile is missing: ${index}`)
    }
    const photo = photos.find((candidate) => candidate.view === view)

    if (photo === undefined) {
      // 미촬영 뷰: 빈 칸을 숨기지 않고 그대로 드러낸다(bee 확정 2026-09-01).
      context.fillStyle = EXPORT_RENDER_STYLE.caption
      context.font = EXPORT_RENDER_STYLE.captionFont
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText("미촬영", tile.x + tile.width / 2, tile.y + tile.height / 2)
    } else {
      const crop = workspaceRenderInstruction(
        buildWorkspaceRenderModel({ alignment: "aligned", framing, photo }),
        { width: tile.width, height: tile.height },
      )

      context.save()
      context.translate(tile.x, tile.y)
      // 타일 경계 클리핑 — cover 크롭은 항상 타일보다 커서, 클립이 없으면
      // 이웃 타일과 라벨을 덮지 않도록 제한합니다.
      context.beginPath()
      context.rect(0, 0, tile.width, tile.height)
      context.clip()
      drawCroppedImage(context, photo.image, crop)
      context.restore()
    }
    context.fillStyle = EXPORT_RENDER_STYLE.ink
    context.font = EXPORT_RENDER_STYLE.labelFont
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(
      `${String(index + 1).padStart(2, "0")} ${VIEW_LABELS[view]}`,
      tile.x + tile.width / 2,
      tile.labelY + SHEET.labelHeight / 2,
    )
  }

  if (options.footer !== undefined && options.footer !== "") {
    context.fillStyle = EXPORT_RENDER_STYLE.caption
    context.font = EXPORT_RENDER_STYLE.captionFont
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(options.footer, SHEET.width / 2, SHEET.height - SHEET.margin / 2)
  }
}

export type PngEncodingCanvas = Pick<HTMLCanvasElement, "toBlob">

export function encodeCanvasPng(canvas: PngEncodingCanvas): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new ContactSheetExportError("PNG encoding failed"))
        return
      }
      resolve(blob)
    }, "image/png")
  })
}

function drawIndividualViewPng<TImage>(
  context: DrawingContext<TImage>,
  photo: WorkspacePhoto<TImage>,
  framing: FramingPreset,
): void {
  const crop = workspaceRenderInstruction(
    buildWorkspaceRenderModel({ alignment: "aligned", framing, photo }),
    INDIVIDUAL_VIEW_SIZE,
  )
  context.fillStyle = EXPORT_RENDER_STYLE.background
  context.fillRect(0, 0, INDIVIDUAL_VIEW_SIZE.width, INDIVIDUAL_VIEW_SIZE.height)
  drawCroppedImage(context, photo.image, crop)
}

function createExportCanvas(
  width: number,
  height: number,
): {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
} {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (context === null) {
    throw new ContactSheetExportError("Canvas is unavailable")
  }
  return { canvas, context }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.download = filename
  anchor.href = url
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function encodedPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await encodeCanvasPng(canvas)
  return new Uint8Array(await blob.arrayBuffer())
}

// PPT 개체 배치: 시트와 같은 타일 격자에, 뷰마다 사진(있으면)과 "01 정면" 캡션을 따로 담는다.
// 미촬영 뷰는 사진 없이 캡션만 — 시트가 빈 칸을 숨기지 않는 규칙과 같다.
async function pptxSheetTiles(
  photos: readonly WorkspacePhoto<CanvasImageSource>[],
  framing: FramingPreset,
  viewSet: ViewSet,
): Promise<readonly PptxSheetTile[]> {
  const tiles = buildContactSheetLayout(SHEET, viewSet.sheetRows)
  const result: PptxSheetTile[] = []
  for (const [index, view] of viewSet.views.entries()) {
    const tile = tiles[index]
    if (tile === undefined) {
      throw new ContactSheetExportError(`Contact sheet tile is missing: ${index}`)
    }
    const photo = photos.find((candidate) => candidate.view === view)
    let jpegBytes: Uint8Array | undefined
    if (photo !== undefined) {
      const { canvas, context } = createExportCanvas(
        INDIVIDUAL_VIEW_SIZE.width,
        INDIVIDUAL_VIEW_SIZE.height,
      )
      drawIndividualViewPng(context, photo, framing)
      jpegBytes = new Uint8Array(await (await encodeCanvasJpeg(canvas)).arrayBuffer())
    }
    result.push({
      frame: { height: tile.height, width: tile.width, x: tile.x, y: tile.y },
      jpegBytes,
      label: `${String(index + 1).padStart(2, "0")} ${VIEW_LABELS[view]}`,
      labelFrame: { height: SHEET.labelHeight, width: tile.width, x: tile.x, y: tile.labelY },
    })
  }
  return result
}

export function encodeCanvasJpeg(canvas: PngEncodingCanvas, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new ContactSheetExportError("JPEG encoding failed"))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      quality,
    )
  })
}

type ExportArtifact = { readonly name: string; readonly data: Uint8Array; readonly type: string }

export async function exportWorkspacePngs(
  photos: readonly WorkspacePhoto<CanvasImageSource>[],
  options: WorkspacePngExportOptions,
): Promise<WorkspacePngExportResult> {
  const viewSet = options.viewSet ?? VIEW_SETS.standardSeven
  if (photos.length < 1 || photos.length > viewSet.views.length) {
    throw new ContactSheetExportError("Between one and the set's view count photos are required")
  }
  const individualPngs = options.individualPngs ?? []
  const wantsSheet =
    options.contactSheet !== undefined ||
    options.contactSheetPdf !== undefined ||
    options.contactSheetPptx !== undefined
  if (!wantsSheet && individualPngs.length === 0) {
    throw new ContactSheetExportError("Choose at least one export")
  }
  if (individualPngs.length !== 0 && individualPngs.length !== photos.length) {
    throw new ContactSheetExportError("Seven individual PNG filenames are required for export")
  }

  const artifacts: ExportArtifact[] = []
  if (wantsSheet) {
    const { canvas, context } = createExportCanvas(SHEET.width, SHEET.height)
    const footer = options.contactSheet?.footer ?? options.sheetFooter ?? ""
    drawWorkspaceContactSheet(context, photos, options.framing, { footer, viewSet })
    if (options.contactSheet !== undefined) {
      artifacts.push({
        name: options.contactSheet.filename,
        data: await encodedPngBytes(canvas),
        type: "image/png",
      })
    }
    if (options.contactSheetPdf !== undefined) {
      const jpegBytes = new Uint8Array(await (await encodeCanvasJpeg(canvas)).arrayBuffer())
      artifacts.push({
        name: options.contactSheetPdf.filename,
        data: buildSinglePagePdf({
          imageHeightPx: SHEET.height,
          imageWidthPx: SHEET.width,
          jpegBytes,
        }),
        type: "application/pdf",
      })
    }
    if (options.contactSheetPptx !== undefined) {
      // PPT는 시트 그림 한 장이 아니라 사진·캡션·하단 문구를 각각 개체로 올린다(2026-09-03 bee).
      // 배치는 시트 레이아웃 그대로, 사진은 개별 PNG와 같은 800×1000 렌더를 JPEG로 담는다.
      artifacts.push({
        name: options.contactSheetPptx.filename,
        data: buildContactSheetPptx({
          background: EXPORT_RENDER_STYLE.background,
          captionColor: EXPORT_RENDER_STYLE.caption,
          footer,
          footerFrame: {
            height: SHEET.margin,
            width: SHEET.width - SHEET.margin * 2,
            x: SHEET.margin,
            y: SHEET.height - SHEET.margin,
          },
          inkColor: EXPORT_RENDER_STYLE.ink,
          sheet: { height: SHEET.height, width: SHEET.width },
          tiles: await pptxSheetTiles(photos, options.framing, viewSet),
        }),
        type: PPTX_MIME_TYPE,
      })
    }
  }
  for (const [index, photo] of photos.entries()) {
    const filename = individualPngs[index]
    if (filename === undefined) {
      continue
    }
    const { canvas, context } = createExportCanvas(
      INDIVIDUAL_VIEW_SIZE.width,
      INDIVIDUAL_VIEW_SIZE.height,
    )
    drawIndividualViewPng(context, photo, options.framing)
    artifacts.push({ name: filename, data: await encodedPngBytes(canvas), type: "image/png" })
  }

  // 다운로드는 항상 정확히 1회다: 파일이 하나면 그 파일, 둘 이상이면 ZIP 하나.
  // 브라우저는 제스처 하나에 자동 다운로드 여러 개를 막는다(2026-09-01 실측).
  const single = artifacts.length === 1 ? artifacts[0] : undefined
  if (single !== undefined) {
    downloadBlob(new Blob([single.data as BlobPart], { type: single.type }), single.name)
  } else {
    if (options.bundleFilename === undefined) {
      throw new ContactSheetExportError("A bundle filename is required for multi-file export")
    }
    downloadBlob(
      new Blob([buildZipStore(artifacts.map(({ name, data }) => ({ name, data }))) as BlobPart], {
        type: "application/zip",
      }),
      options.bundleFilename,
    )
  }

  return { contactSheetExported: wantsSheet }
}

export async function exportContactSheetPng(
  photos: readonly WorkspacePhoto<CanvasImageSource>[],
  framing: FramingPreset,
): Promise<void> {
  await exportWorkspacePngs(photos, {
    framing,
    contactSheet: {
      filename: `sevenview-${new Date().toISOString().slice(0, 10)}.png`,
      footer: "",
    },
  })
}
