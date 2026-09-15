// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import {
  buildContactSheetPptx,
  buildContactSheetPptxDeck,
  type PptxSheetTile,
  pptxPartNames,
  sheetFrameToEmu,
  slidePictureFrame,
} from "../src/adapters/pptx-store"
import { zipEntries } from "./support/comparison-export-fixtures"

const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")

const utf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

const SHEET = { width: 2400, height: 1600 } as const
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])

function tile(index: number, withPhoto: boolean): PptxSheetTile {
  const x = 100 + index * 560
  return {
    frame: { height: 700, width: 560, x, y: 200 },
    jpegBytes: withPhoto ? JPEG : undefined,
    label: `0${index + 1} 뷰${index + 1}`,
    labelFrame: { height: 54, width: 560, x, y: 900 },
  }
}

describe("contact-sheet PPTX writer", () => {
  it("links every slide and its own raster when a multi-slide deck is written", () => {
    // Given: distinct raster bytes identify the image belonging to each slide.
    const sheets = [1, 2, 3].map((index) => ({
      sheet: SHEET,
      footerFrame: { x: 0, y: 0, width: 0, height: 0 },
      tiles: [
        {
          ...tile(0, true),
          jpegBytes: new Uint8Array([0xff, 0xd8, index]),
          label: `page-${index}`,
        },
      ],
    }))

    // When: one package contains all slides.
    const entries = zipEntries(buildContactSheetPptxDeck(sheets))

    // Then: presentation, content types and per-slide relationships resolve every page raster.
    const presentation = utf8(entries.get("ppt/presentation.xml") ?? new Uint8Array())
    expect(presentation.match(/<p:sldId /gu)).toHaveLength(3)
    const types = utf8(entries.get("[Content_Types].xml") ?? new Uint8Array())
    for (const index of [1, 2, 3]) {
      expect(types).toContain(`/ppt/slides/slide${index}.xml`)
      expect(utf8(entries.get(`ppt/slides/slide${index}.xml`) ?? new Uint8Array())).toContain(
        `page-${index}`,
      )
      expect(
        utf8(entries.get(`ppt/slides/_rels/slide${index}.xml.rels`) ?? new Uint8Array()),
      ).toContain(`../media/image${index}.jpg`)
      expect(entries.get(`ppt/media/image${index}.jpg`)).toEqual(
        new Uint8Array([0xff, 0xd8, index]),
      )
    }
    expect(utf8(entries.get("ppt/_rels/presentation.xml.rels") ?? new Uint8Array())).toContain(
      'Target="slides/slide3.xml"',
    )
  })

  it("centers a 3:2 sheet inside the 16:9 slide with a half-inch margin", () => {
    const frame = slidePictureFrame(2400, 1600)
    expect(frame.cy).toBe(6_858_000 - 457_200 * 2)
    expect(frame.cx).toBe(Math.round(frame.cy * 1.5))
    expect(frame.x).toBe(Math.round((12_192_000 - frame.cx) / 2))
    expect(frame.y).toBe(457_200)
  })

  it("maps sheet pixels onto the same frame the whole sheet would occupy", () => {
    // 시트 전체(0,0,2400,1600)는 시트 그림 한 장이 놓였던 자리와 정확히 같아야 한다.
    const whole = sheetFrameToEmu(SHEET, { height: 1600, width: 2400, x: 0, y: 0 })
    expect(whole).toEqual(slidePictureFrame(2400, 1600))
    // 타일은 같은 배율로 안쪽에 들어간다.
    const inner = sheetFrameToEmu(SHEET, { height: 800, width: 1200, x: 600, y: 400 })
    expect(inner.cx).toBe(Math.round(whole.cx / 2))
    expect(inner.cy).toBe(Math.round(whole.cy / 2))
    expect(inner.x).toBe(Math.round(whole.x + whole.cx / 4))
  })

  it("places every photo, caption and the footer as its own editable object", () => {
    // Given: 4장 중 3장만 촬영된 세트와 하단 문구.
    const tiles = [tile(0, true), tile(1, true), tile(2, false), tile(3, true)]
    const pptx = buildContactSheetPptx({
      background: "#f4f4f2",
      captionColor: "#6b7280",
      footer: "SevenView · 2026-09-03 · 임상 확정 전 초안",
      footerFrame: { height: 80, width: 2240, x: 80, y: 1520 },
      inkColor: "#1f2a44",
      sheet: SHEET,
      tiles,
    })
    const text = latin1(pptx)
    const readable = utf8(pptx)

    expect(text.startsWith("PK")).toBe(true)
    // 사진 3장 → 미디어 파트 3개, 그 이상은 없다.
    for (const part of pptxPartNames(3)) {
      expect(text).toContain(part)
    }
    expect(text).not.toContain("ppt/media/image4.jpg")
    expect(text).not.toContain(".png")

    // 각 XML 파트는 파싱 오류 없이 읽혀야 한다(PowerPoint·Keynote가 여는 최소 조건).
    const parser = new DOMParser()
    const xmlParts = [...readable.matchAll(/<\?xml[\s\S]*?(?=PK)/g)]
    expect(xmlParts.length).toBeGreaterThanOrEqual(11)
    for (const [xml] of xmlParts) {
      const parsed = parser.parseFromString(xml, "application/xml")
      expect(parsed.querySelector("parsererror")).toBeNull()
    }

    // 슬라이드: 그림 3개(rId2~4), 캡션 4개, 미촬영 1개, 하단 문구 1개 — 모두 개별 개체.
    const slideXml = xmlParts.map(([xml]) => xml).find((xml) => xml.includes("<p:sld ")) ?? ""
    expect(slideXml.match(/<p:pic>/g)).toHaveLength(3)
    expect(slideXml).toContain('r:embed="rId2"')
    expect(slideXml).toContain('r:embed="rId4"')
    expect(slideXml).not.toContain('r:embed="rId5"')
    expect(slideXml.match(/<p:sp>/g)).toHaveLength(4 + 1 + 1)
    for (const item of tiles) {
      expect(slideXml).toContain(`<a:t>${item.label}</a:t>`)
    }
    expect(slideXml).toContain("<a:t>미촬영</a:t>")
    expect(slideXml).toContain("<a:t>SevenView · 2026-09-03 · 임상 확정 전 초안</a:t>")
    expect(slideXml).toContain('<a:srgbClr val="F4F4F2"/>')
    expect(slideXml).toContain('<a:srgbClr val="1F2A44"/>')
    const slideDocument = parser.parseFromString(slideXml, "application/xml")
    const bodyProperties = [...slideDocument.getElementsByTagNameNS("*", "bodyPr")]
    const paragraphProperties = [...slideDocument.getElementsByTagNameNS("*", "pPr")]
    expect(bodyProperties.every((properties) => properties.getAttribute("anchor") === "ctr")).toBe(
      true,
    )
    expect(
      paragraphProperties.every((properties) => properties.getAttribute("algn") === "ctr"),
    ).toBe(true)
    // 도형 id는 슬라이드 안에서 유일해야 한다(중복이면 PowerPoint가 복구 모드로 연다).
    const ids = [...slideXml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)

    // 관계 파일은 그림마다 미디어 파트를 가리킨다.
    const rels = xmlParts.map(([xml]) => xml).find((xml) => xml.includes("../media/image1.jpg"))
    expect(rels).toContain(
      'Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image3.jpg"',
    )
  })

  it("omits the footer object when the footer is empty", () => {
    const pptx = buildContactSheetPptx({
      footer: "",
      footerFrame: { height: 80, width: 2240, x: 80, y: 1520 },
      sheet: SHEET,
      tiles: [tile(0, true)],
    })
    const readable = utf8(pptx)
    expect(readable).not.toContain("하단 문구")
    expect(readable.match(/<p:sp>/g)).toHaveLength(1)
  })
})
