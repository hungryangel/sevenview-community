export type PptxFrame = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type PptxSheetTile = {
  readonly frame: PptxFrame
  readonly jpegBytes?: Uint8Array | undefined
  readonly label: string
  readonly labelFrame: PptxFrame
}

export type ContactSheetPptxInput = {
  readonly background?: string
  readonly captionColor?: string
  readonly inkColor?: string
  readonly footer?: string
  readonly footerFrame: PptxFrame
  readonly sheet: { readonly width: number; readonly height: number }
  readonly tiles: readonly PptxSheetTile[]
  readonly textBoxes?: readonly {
    readonly align?: "left" | "center" | undefined
    readonly frame: PptxFrame
    readonly name: string
    readonly text: string
    readonly color?: string
    readonly size?: number
    readonly verticalAlign?: "top" | "center" | undefined
  }[]
}

export const PPTX_SLIDE_WIDTH_EMU = 12_192_000
export const PPTX_SLIDE_HEIGHT_EMU = 6_858_000
const SLIDE_MARGIN_EMU = 457_200
const CAPTION_SIZE = 1200
const FOOTER_SIZE = 1000
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
const EMPTY_GROUP = `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`

function escapeXml(value: string): string {
  let normalized = ""
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    const isXml10Character =
      codePoint === 0x09 ||
      codePoint === 0x0a ||
      codePoint === 0x0d ||
      (codePoint !== undefined && codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint !== undefined && codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint !== undefined && codePoint >= 0x10000 && codePoint <= 0x10ffff)
    normalized += isXml10Character ? character : "\ufffd"
  }
  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function hexColor(value: string | undefined, fallback: string): string {
  const match = value === undefined ? null : /^#?([0-9a-fA-F]{6})$/.exec(value.trim())
  return match?.[1] === undefined ? fallback : match[1].toUpperCase()
}

export function slidePictureFrame(
  imageWidthPx: number,
  imageHeightPx: number,
): { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number } {
  const maxWidth = PPTX_SLIDE_WIDTH_EMU - SLIDE_MARGIN_EMU * 2
  const maxHeight = PPTX_SLIDE_HEIGHT_EMU - SLIDE_MARGIN_EMU * 2
  const scale = Math.min(maxWidth / imageWidthPx, maxHeight / imageHeightPx)
  const cx = Math.round(imageWidthPx * scale)
  const cy = Math.round(imageHeightPx * scale)
  return {
    x: Math.round((PPTX_SLIDE_WIDTH_EMU - cx) / 2),
    y: Math.round((PPTX_SLIDE_HEIGHT_EMU - cy) / 2),
    cx,
    cy,
  }
}

export function sheetFrameToEmu(
  sheet: { readonly width: number; readonly height: number },
  frame: PptxFrame,
): { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number } {
  const sheetFrame = slidePictureFrame(sheet.width, sheet.height)
  const scale = sheetFrame.cx / sheet.width
  return {
    x: Math.round(sheetFrame.x + frame.x * scale),
    y: Math.round(sheetFrame.y + frame.y * scale),
    cx: Math.round(frame.width * scale),
    cy: Math.round(frame.height * scale),
  }
}

function xfrm(box: { x: number; y: number; cx: number; cy: number }): string {
  return `<a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.cx}" cy="${box.cy}"/></a:xfrm>`
}

function pictureShape(
  id: number,
  relId: string,
  name: string,
  box: { x: number; y: number; cx: number; cy: number },
): string {
  const safeName = escapeXml(name)
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${safeName}" descr="${safeName}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  )
}

function textShape(
  id: number,
  name: string,
  text: string,
  box: { x: number; y: number; cx: number; cy: number },
  style: {
    readonly align?: "left" | "center" | undefined
    readonly color: string
    readonly size: number
    readonly verticalAlign?: "top" | "center" | undefined
  },
): string {
  const alignment = style.align === "left" ? "l" : "ctr"
  const anchor = style.verticalAlign === "top" ? "t" : "ctr"
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>` +
    `<a:p><a:pPr algn="${alignment}"/><a:r><a:rPr lang="ko-KR" altLang="en-US" sz="${style.size}" dirty="0"><a:solidFill><a:srgbClr val="${style.color}"/></a:solidFill></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>` +
    `<a:endParaRPr lang="ko-KR" altLang="en-US" sz="${style.size}" dirty="0"/></a:p></p:txBody></p:sp>`
  )
}

type SlideMedia = { readonly relId: string; readonly partName: string; readonly data: Uint8Array }

export function serializePptxSlide(input: ContactSheetPptxInput) {
  const ink = hexColor(input.inkColor, "1F2A44")
  const caption = hexColor(input.captionColor, "6B7280")
  const background = hexColor(input.background, "F4F4F2")
  const media: SlideMedia[] = []
  const shapes: string[] = []
  let nextId = 2

  for (const tile of input.tiles) {
    const frame = sheetFrameToEmu(input.sheet, tile.frame)
    if (tile.jpegBytes === undefined) {
      shapes.push(
        textShape(nextId, `미촬영 ${tile.label}`, "미촬영", frame, {
          color: caption,
          size: CAPTION_SIZE,
        }),
      )
      nextId += 1
    } else {
      const relId = `rId${media.length + 2}`
      media.push({
        relId,
        partName: `ppt/media/image${media.length + 1}.jpg`,
        data: tile.jpegBytes,
      })
      shapes.push(pictureShape(nextId, relId, tile.label, frame))
      nextId += 1
    }
    shapes.push(
      textShape(
        nextId,
        `캡션 ${tile.label}`,
        tile.label,
        sheetFrameToEmu(input.sheet, tile.labelFrame),
        {
          color: ink,
          size: CAPTION_SIZE,
        },
      ),
    )
    nextId += 1
  }
  if (input.footer !== undefined && input.footer !== "") {
    shapes.push(
      textShape(
        nextId,
        "하단 문구",
        input.footer,
        sheetFrameToEmu(input.sheet, input.footerFrame),
        { color: caption, size: FOOTER_SIZE },
      ),
    )
  }
  for (const textBox of input.textBoxes ?? []) {
    shapes.push(
      textShape(nextId, textBox.name, textBox.text, sheetFrameToEmu(input.sheet, textBox.frame), {
        align: textBox.align,
        color: hexColor(textBox.color, ink),
        size: textBox.size ?? CAPTION_SIZE,
        verticalAlign: textBox.verticalAlign,
      }),
    )
    nextId += 1
  }
  const xml =
    `${XML_HEADER}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld>` +
    `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` +
    `<p:spTree>${EMPTY_GROUP}${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  return { xml, media }
}
