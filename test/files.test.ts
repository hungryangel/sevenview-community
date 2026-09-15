// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { parseImageFiles } from "../src/domain/files"

function imageFile(name: string, type = "image/jpeg", size = 16): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe("parseImageFiles", () => {
  it("accepts up to seven supported local image files", () => {
    // Given: a partial set of supported JPEG and PNG images.
    const files = [imageFile("front.jpg"), imageFile("profile.png", "image/png")]

    // When: the browser input boundary is parsed.
    const result = parseImageFiles(files)

    // Then: the files remain available for local processing.
    expect(result).toEqual({ kind: "accepted", files })
  })

  it("rejects a non-image without silently dropping it", () => {
    // Given: an unsupported PDF next to a valid image.
    const files = [imageFile("front.jpg"), imageFile("notes.pdf", "application/pdf")]

    // When: the boundary is parsed.
    const result = parseImageFiles(files)

    // Then: the caller receives a recoverable typed error.
    expect(result).toEqual({
      kind: "rejected",
      error: { code: "unsupported_type", fileName: "notes.pdf" },
    })
  })

  it("identifies DSLR RAW files with a dedicated error instead of a generic one", () => {
    // Given: a Canon RAW file that browsers cannot decode.
    const files = [imageFile("IMG_0001.CR3", "")]

    // When: the boundary is parsed.
    const result = parseImageFiles(files)

    // Then: the caller can tell the user to use the paired JPEG.
    expect(result).toEqual({
      kind: "rejected",
      error: { code: "raw_unsupported", fileName: "IMG_0001.CR3" },
    })
  })

  it("identifies iPhone HEIC files by extension or MIME type", () => {
    expect(parseImageFiles([imageFile("IMG_0002.HEIC", "")])).toEqual({
      kind: "rejected",
      error: { code: "heic_unsupported", fileName: "IMG_0002.HEIC" },
    })
    expect(parseImageFiles([imageFile("photo", "image/heic")])).toEqual({
      kind: "rejected",
      error: { code: "heic_unsupported", fileName: "photo" },
    })
  })

  it("accepts up to twelve images so spares can ride along", () => {
    const files = Array.from({ length: 12 }, (_, index) => imageFile(`${index}.jpg`))
    expect(parseImageFiles(files)).toEqual({ kind: "accepted", files })
  })

  it("rejects a thirteenth image before any analysis begins", () => {
    // Given: thirteen otherwise valid images.
    const files = Array.from({ length: 13 }, (_, index) => imageFile(`${index}.jpg`))

    // When: the boundary is parsed.
    const result = parseImageFiles(files)

    // Then: the batch-size error is explicit.
    expect(result).toEqual({
      kind: "rejected",
      error: { code: "too_many", maximum: 12, actual: 13 },
    })
  })
})
