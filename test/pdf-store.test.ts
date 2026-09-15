import { describe, expect, it } from "vitest"

import { buildSinglePagePdf, pdfPageSizeFor } from "../src/adapters/pdf-store"

const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")

describe("single-page PDF writer", () => {
  it("fits the sheet aspect onto a 12-inch-wide landscape page", () => {
    expect(pdfPageSizeFor(2400, 1600)).toEqual({ width: 864, height: 576 })
    expect(pdfPageSizeFor(800, 1000)).toEqual({ width: 691.2, height: 864 })
  })

  it("writes a valid xref table around the embedded JPEG image", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
    ])
    const pdf = buildSinglePagePdf({ imageHeightPx: 1600, imageWidthPx: 2400, jpegBytes: jpeg })
    const text = latin1(pdf)

    expect(text.startsWith("%PDF-1.4\n")).toBe(true)
    expect(text).toContain("/Subtype /Image /Width 2400 /Height 1600")
    expect(text).toContain("/Filter /DCTDecode /Length 12")
    expect(text).toContain("/MediaBox [0 0 864 576]")
    expect(text).toContain("q 864 0 0 576 0 0 cm /Im1 Do Q")
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true)

    // startxref는 실제 xref 위치를 가리키고, 각 항목은 해당 객체의 시작 위치다.
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)?.[1])
    expect(text.slice(startxref, startxref + 4)).toBe("xref")
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n /gm)].map((match) => Number(match[1]))
    expect(offsets).toHaveLength(6)
    offsets.forEach((offset, index) => {
      const head = `${index + 1} 0 obj`
      expect(text.slice(offset, offset + head.length)).toBe(head)
    })
  })
})
