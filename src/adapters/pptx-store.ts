import {
  type ContactSheetPptxInput,
  PPTX_SLIDE_HEIGHT_EMU,
  PPTX_SLIDE_WIDTH_EMU,
  serializePptxSlide,
} from "./pptx-slide-serializer"
import { buildZipStore } from "./zip-store"

export type {
  ContactSheetPptxInput,
  PptxFrame,
  PptxSheetTile,
} from "./pptx-slide-serializer"
export {
  sheetFrameToEmu,
  slidePictureFrame,
} from "./pptx-slide-serializer"

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
const REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const encoder = new TextEncoder()

function relationships(entries: readonly { id: string; type: string; target: string }[]): string {
  const body = entries
    .map(
      (entry) =>
        `<Relationship Id="${entry.id}" Type="${REL_TYPE}/${entry.type}" Target="${entry.target}"/>`,
    )
    .join("")
  return `${XML_HEADER}<Relationships xmlns="${REL_NS}">${body}</Relationships>`
}

const EMPTY_GROUP = `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`

function schemeColors(): string {
  const colors: readonly [string, string][] = [
    ["dk1", "000000"],
    ["lt1", "FFFFFF"],
    ["dk2", "1F2A44"],
    ["lt2", "EEECE1"],
    ["accent1", "6E6BFF"],
    ["accent2", "4ADE80"],
    ["accent3", "F59E0B"],
    ["accent4", "EF4444"],
    ["accent5", "38BDF8"],
    ["accent6", "A78BFA"],
    ["hlink", "6E6BFF"],
    ["folHlink", "A78BFA"],
  ]
  return colors.map(([name, hex]) => `<a:${name}><a:srgbClr val="${hex}"/></a:${name}>`).join("")
}

function theme(): string {
  const fill = `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>`
  const line = `<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>`
  const effect = `<a:effectStyle><a:effectLst/></a:effectStyle>`
  const font = `<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/>`
  return (
    `${XML_HEADER}<a:theme xmlns:a="${NS_A}" name="SevenView"><a:themeElements>` +
    `<a:clrScheme name="SevenView">${schemeColors()}</a:clrScheme>` +
    `<a:fontScheme name="SevenView"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="SevenView"><a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst>` +
    `<a:lnStyleLst>${line}${line}${line}</a:lnStyleLst>` +
    `<a:effectStyleLst>${effect}${effect}${effect}</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst></a:fmtScheme>` +
    `</a:themeElements></a:theme>`
  )
}

function slideMaster(): string {
  return (
    `${XML_HEADER}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${EMPTY_GROUP}</p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`
  )
}

function slideLayout(): string {
  return (
    `${XML_HEADER}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="blank" preserve="1">` +
    `<p:cSld name="Blank"><p:spTree>${EMPTY_GROUP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
  )
}

function presentation(slideCount: number): string {
  return (
    `${XML_HEADER}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("")}</p:sldIdLst>` +
    `<p:sldSz cx="${PPTX_SLIDE_WIDTH_EMU}" cy="${PPTX_SLIDE_HEIGHT_EMU}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
  )
}

function contentTypes(slideCount: number): string {
  const override = (part: string, type: string) =>
    `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}"/>`
  return (
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="jpg" ContentType="image/jpeg"/>` +
    override("/ppt/presentation.xml", "presentationml.presentation.main+xml") +
    override("/ppt/slideMasters/slideMaster1.xml", "presentationml.slideMaster+xml") +
    override("/ppt/slideLayouts/slideLayout1.xml", "presentationml.slideLayout+xml") +
    Array.from({ length: slideCount }, (_, index) =>
      override(`/ppt/slides/slide${index + 1}.xml`, "presentationml.slide+xml"),
    ).join("") +
    override("/ppt/theme/theme1.xml", "theme+xml") +
    `</Types>`
  )
}

export const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"

export function pptxPartNames(imageCount = 1): readonly string[] {
  return [
    "[Content_Types].xml",
    "_rels/.rels",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
    "ppt/slideMasters/slideMaster1.xml",
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    "ppt/slideLayouts/slideLayout1.xml",
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    "ppt/theme/theme1.xml",
    "ppt/slides/slide1.xml",
    "ppt/slides/_rels/slide1.xml.rels",
    ...Array.from({ length: imageCount }, (_, index) => `ppt/media/image${index + 1}.jpg`),
  ]
}

export function buildContactSheetPptx(input: ContactSheetPptxInput): Uint8Array {
  return buildContactSheetPptxDeck([input])
}

export function buildContactSheetPptxDeck(inputs: readonly ContactSheetPptxInput[]): Uint8Array {
  const text = (xml: string) => encoder.encode(xml)
  let imageCount = 0
  const slides = inputs.map((input) => {
    const slide = serializePptxSlide(input)
    const media = slide.media.map((item) => ({
      ...item,
      partName: `ppt/media/image${++imageCount}.jpg`,
    }))
    return { xml: slide.xml, media }
  })
  const entries: readonly { name: string; data: Uint8Array }[] = [
    { name: "[Content_Types].xml", data: text(contentTypes(slides.length)) },
    {
      name: "_rels/.rels",
      data: text(
        relationships([{ id: "rId1", type: "officeDocument", target: "ppt/presentation.xml" }]),
      ),
    },
    { name: "ppt/presentation.xml", data: text(presentation(slides.length)) },
    {
      name: "ppt/_rels/presentation.xml.rels",
      data: text(
        relationships([
          { id: "rId1", type: "slideMaster", target: "slideMasters/slideMaster1.xml" },
          ...slides.map((_, index) => ({
            id: `rId${index + 2}`,
            type: "slide",
            target: `slides/slide${index + 1}.xml`,
          })),
          { id: `rId${slides.length + 2}`, type: "theme", target: "theme/theme1.xml" },
        ]),
      ),
    },
    { name: "ppt/slideMasters/slideMaster1.xml", data: text(slideMaster()) },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      data: text(
        relationships([
          { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" },
          { id: "rId2", type: "theme", target: "../theme/theme1.xml" },
        ]),
      ),
    },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: text(slideLayout()) },
    {
      name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      data: text(
        relationships([
          { id: "rId1", type: "slideMaster", target: "../slideMasters/slideMaster1.xml" },
        ]),
      ),
    },
    { name: "ppt/theme/theme1.xml", data: text(theme()) },
    ...slides.flatMap((slide, index) => [
      { name: `ppt/slides/slide${index + 1}.xml`, data: text(slide.xml) },
      {
        name: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
        data: text(
          relationships([
            { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" },
            ...slide.media.map((item) => ({
              id: item.relId,
              type: "image",
              target: item.partName.replace("ppt/", "../"),
            })),
          ]),
        ),
      },
      ...slide.media.map((item) => ({ name: item.partName, data: item.data })),
    ]),
  ]
  return buildZipStore(entries)
}
