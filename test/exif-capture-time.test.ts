import { describe, expect, it } from "vitest"

import {
  parseExifCaptureTime,
  parseExifSummary,
  sortFilesByCaptureTime,
} from "../src/domain/exif-capture-time"

type TiffAsciiEntry = {
  readonly tag: number
  readonly value: string
}

function jpegWithIfd0AndExif(options: {
  readonly ifd0Ascii: readonly TiffAsciiEntry[]
  readonly dateTimeOriginal?: string
}): Uint8Array {
  const encoder = new TextEncoder()
  const ifd0Ascii = options.ifd0Ascii.map((entry) => ({
    tag: entry.tag,
    data: encoder.encode(`${entry.value}\0`),
  }))
  const exifAscii =
    options.dateTimeOriginal === undefined
      ? []
      : [{ tag: 0x9003, data: encoder.encode(`${options.dateTimeOriginal}\0`) }]
  const ifd0Count = ifd0Ascii.length + (exifAscii.length > 0 ? 1 : 0)
  const ifd0Offset = 8
  const ifd0Bytes = 2 + ifd0Count * 12 + 4
  const exifIfdOffset = ifd0Offset + ifd0Bytes
  const exifIfdBytes = exifAscii.length > 0 ? 2 + exifAscii.length * 12 + 4 : 0
  let dataOffset = exifIfdOffset + exifIfdBytes
  const dataPlacements = [...ifd0Ascii, ...exifAscii].map((entry) => {
    const placement = { ...entry, offset: dataOffset }
    dataOffset += entry.data.length
    return placement
  })
  const tiff = new Uint8Array(dataOffset)
  const view = new DataView(tiff.buffer)
  tiff.set([0x49, 0x49, 0x2a, 0x00])
  view.setUint32(4, ifd0Offset, true)

  const writeEntry = (at: number, tag: number, count: number, valueOffset: number) => {
    view.setUint16(at, tag, true)
    view.setUint16(at + 2, 2, true)
    view.setUint32(at + 4, count, true)
    view.setUint32(at + 8, valueOffset, true)
  }

  view.setUint16(ifd0Offset, ifd0Count, true)
  let entryAt = ifd0Offset + 2
  for (const entry of ifd0Ascii) {
    const placement = dataPlacements.find((candidate) => candidate.tag === entry.tag)
    writeEntry(entryAt, entry.tag, entry.data.length, placement?.offset ?? 0)
    entryAt += 12
  }
  if (exifAscii.length > 0) {
    view.setUint16(entryAt, 0x8769, true)
    view.setUint16(entryAt + 2, 4, true)
    view.setUint32(entryAt + 4, 1, true)
    view.setUint32(entryAt + 8, exifIfdOffset, true)
    entryAt += 12
  }
  view.setUint32(entryAt, 0, true)

  if (exifAscii.length > 0) {
    view.setUint16(exifIfdOffset, exifAscii.length, true)
    let exifEntryAt = exifIfdOffset + 2
    for (const entry of exifAscii) {
      const placement = dataPlacements.find((candidate) => candidate.tag === entry.tag)
      writeEntry(exifEntryAt, entry.tag, entry.data.length, placement?.offset ?? 0)
      exifEntryAt += 12
    }
    view.setUint32(exifEntryAt, 0, true)
  }

  for (const placement of dataPlacements) {
    tiff.set(placement.data, placement.offset)
  }

  const app1 = new Uint8Array(6 + tiff.length)
  app1.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00])
  app1.set(tiff, 6)
  const length = app1.length + 2
  const jpeg = new Uint8Array(2 + 2 + 2 + app1.length + 2)
  jpeg.set([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff])
  jpeg.set(app1, 6)
  jpeg.set([0xff, 0xd9], 6 + app1.length)
  return jpeg
}

function littleEndianJpegWithDateTimeOriginal(value: string): Uint8Array {
  const text = new TextEncoder().encode(`${value}\0`)
  const tiff = new Uint8Array(56 + text.length)
  tiff.set([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00], 0)
  tiff.set([0x01, 0x00], 8)
  tiff.set([0x69, 0x87, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00], 10)
  tiff.set([0x00, 0x00, 0x00, 0x00], 22)
  tiff.set([0x01, 0x00], 26)
  tiff.set([0x03, 0x90, 0x02, 0x00, text.length, 0x00, 0x00, 0x00, 0x38, 0x00, 0x00, 0x00], 28)
  tiff.set([0x00, 0x00, 0x00, 0x00], 40)
  tiff.set(text, 56)
  const app1 = new Uint8Array(6 + tiff.length)
  app1.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00])
  app1.set(tiff, 6)
  const length = app1.length + 2
  const jpeg = new Uint8Array(2 + 2 + 2 + app1.length + 2)
  jpeg.set([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff])
  jpeg.set(app1, 6)
  jpeg.set([0xff, 0xd9], 6 + app1.length)
  return jpeg
}

function localFile(bytes: Uint8Array, name: string): File {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new File([copy], name, { type: "image/jpeg" })
}

describe("parseExifCaptureTime", () => {
  it("reads DateTimeOriginal from a local JPEG EXIF block", () => {
    // Given: a JPEG byte sequence containing a capture timestamp.
    const jpeg = littleEndianJpegWithDateTimeOriginal("2026:08:31 09:05:03")

    // When: its EXIF metadata is parsed locally.
    const captureTime = parseExifCaptureTime(jpeg)

    // Then: the sortable timestamp is available without retaining image metadata for output.
    expect(captureTime?.getFullYear()).toBe(2026)
    expect(captureTime?.getMonth()).toBe(7)
    expect(captureTime?.getDate()).toBe(31)
    expect(captureTime?.getHours()).toBe(9)
  })

  it("returns null for bytes without EXIF rather than inventing a capture time", () => {
    expect(parseExifCaptureTime(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull()
  })

  it("reads IFD0 camera make/model together with the capture time", () => {
    const jpeg = jpegWithIfd0AndExif({
      ifd0Ascii: [
        { tag: 0x010f, value: "Canon" },
        { tag: 0x0110, value: "Canon EOS R6" },
      ],
      dateTimeOriginal: "2026:09:01 10:00:00",
    })

    const summary = parseExifSummary(jpeg)

    expect(summary.cameraMake).toBe("Canon")
    expect(summary.cameraModel).toBe("Canon EOS R6")
    expect(summary.captureTime?.getHours()).toBe(10)
  })

  it("keeps camera fields null when IFD0 has no make/model entries", () => {
    const jpeg = jpegWithIfd0AndExif({ ifd0Ascii: [], dateTimeOriginal: "2026:09:01 10:00:00" })

    const summary = parseExifSummary(jpeg)

    expect(summary.cameraMake).toBeNull()
    expect(summary.cameraModel).toBeNull()
    expect(summary.captureTime).not.toBeNull()
  })

  it("uses capture time when present and falls back to filename order when absent", async () => {
    const early = localFile(
      littleEndianJpegWithDateTimeOriginal("2026:08:31 09:05:03"),
      "z-early.jpg",
    )
    const late = localFile(
      littleEndianJpegWithDateTimeOriginal("2026:08:31 10:05:03"),
      "a-late.jpg",
    )
    const noCaptureTimeA = localFile(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), "b.jpg")
    const noCaptureTimeB = localFile(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), "a.jpg")

    await expect(sortFilesByCaptureTime([late, early])).resolves.toEqual([early, late])
    await expect(sortFilesByCaptureTime([noCaptureTimeA, noCaptureTimeB])).resolves.toEqual([
      noCaptureTimeB,
      noCaptureTimeA,
    ])
  })
})
