// 한 페이지 PDF 작성기(2026-09-03): 컨택트 시트 JPEG 한 장을 페이지에 꽉 채운다.
// 외부 라이브러리 없이 PDF 1.4 최소 구조(카탈로그·페이지·내용 스트림·이미지 XObject·xref)만
// 쓴다. 이미지는 DCTDecode(JPEG)로 그대로 실어 크기가 작고 어디서나 열린다.
export type SinglePagePdfInput = {
  readonly jpegBytes: Uint8Array
  readonly imageWidthPx: number
  readonly imageHeightPx: number
  // 긴 변의 페이지 크기(pt). 2400×1600 시트는 864×576pt(12×8인치)가 된다.
  readonly longSidePoints?: number
  readonly producer?: string
}

const encoder = new TextEncoder()

function ascii(text: string): Uint8Array {
  return encoder.encode(text)
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function pdfPageSizeFor(
  imageWidthPx: number,
  imageHeightPx: number,
  longSidePoints = 864,
): { readonly width: number; readonly height: number } {
  if (imageWidthPx >= imageHeightPx) {
    return { width: longSidePoints, height: (longSidePoints * imageHeightPx) / imageWidthPx }
  }
  return { width: (longSidePoints * imageWidthPx) / imageHeightPx, height: longSidePoints }
}

export function buildSinglePagePdf(input: SinglePagePdfInput): Uint8Array {
  const page = pdfPageSizeFor(input.imageWidthPx, input.imageHeightPx, input.longSidePoints)
  const width = formatPoints(page.width)
  const height = formatPoints(page.height)
  const content = ascii(`q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q\n`)
  const producer = (input.producer ?? "SevenView").replace(/[()\\]/g, "")

  const objects: readonly (readonly Uint8Array[])[] = [
    [ascii("<< /Type /Catalog /Pages 2 0 R >>")],
    [ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")],
    [
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>`,
      ),
    ],
    [ascii(`<< /Length ${content.byteLength} >>\nstream\n`), content, ascii("endstream")],
    [
      ascii(
        `<< /Type /XObject /Subtype /Image /Width ${input.imageWidthPx} /Height ${input.imageHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.jpegBytes.byteLength} >>\nstream\n`,
      ),
      input.jpegBytes,
      ascii("\nendstream"),
    ],
    [ascii(`<< /Producer (${producer}) >>`)],
  ]

  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n%âãÏÓ\n")]
  let offset = chunks[0]?.byteLength ?? 0
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(offset)
    const head = ascii(`${index + 1} 0 obj\n`)
    const tail = ascii("\nendobj\n")
    const parts = [head, ...body, tail]
    for (const part of parts) {
      chunks.push(part)
      offset += part.byteLength
    }
  })

  const xrefOffset = offset
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.map((value) => `${String(value).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("")
  chunks.push(ascii(xref))
  return concat(chunks)
}
