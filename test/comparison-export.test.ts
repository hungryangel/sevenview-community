import { describe, expect, it } from "vitest"
import { ComparisonCanvasError } from "../src/adapters/comparison-canvas"
import { exportComparison } from "../src/adapters/comparison-export"
import { PPTX_MIME_TYPE } from "../src/adapters/pptx-store"
import { createComparisonExportSettings } from "../src/domain/comparison-export"
import {
  comparisonExportFixture,
  comparisonExportPair,
  requiredBlob,
  zipEntries,
} from "./support/comparison-export-fixtures"

const defaults = createComparisonExportSettings("Session/private: 7")
const decoder = new TextDecoder()

describe("comparison format exports", () => {
  it("downloads only the paired PNG when the default selection is used", async () => {
    // Given: the default comparison settings and a canvas boundary fake.
    const fixture = comparisonExportFixture()
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, defaults, fixture.dependencies)
    // Then: one fresh 1600×1000 PNG is downloaded without rendering the filename.
    const blob = requiredBlob(fixture.blobs)
    expect(blob.type).toBe("image/png")
    expect(fixture.anchor.download).toBe("Session-private- 7_before-after.png")
    expect(fixture.anchor.click).toHaveBeenCalledTimes(1)
    expect(fixture.canvases.map(({ width, height }) => [width, height])).toEqual([[1600, 1000]])
    expect(await blob.text()).not.toContain("Session")
    expect(fixture.revokeObjectUrl).toHaveBeenCalledWith("blob:comparison-export")
  })

  it("withholds an encoded artifact when the captured session becomes stale", async () => {
    const fixture = comparisonExportFixture()

    const outcome = await exportComparison(
      comparisonExportPair,
      defaults,
      fixture.dependencies,
      () => false,
    )

    expect(outcome).toBe("stale")
    expect(fixture.canvases).toHaveLength(1)
    expect(fixture.anchor.click).not.toHaveBeenCalled()
    expect(fixture.blobs).toEqual([])
  })

  it("creates one PDF page with the same ordered pair when PDF alone is selected", async () => {
    // Given: only PDF, after-first order.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      order: "afterBefore",
      selection: {
        png: false,
        individualPngs: false,
        pdf: true,
        pptx: false,
        html: false,
      },
    } as const
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: the JPEG pair fills exactly one PDF page, with semantic captions.
    const blob = requiredBlob(fixture.blobs)
    const text = await blob.text()
    expect(blob.type).toBe("application/pdf")
    expect(text).toContain("/Count 1")
    expect(text).toContain("/Width 1600 /Height 1000")
    expect(text).toContain("/MediaBox [0 0 864 540]")
    expect(text.indexOf("image:after-pixels")).toBeLessThan(text.indexOf("image:before-pixels"))
    expect(text).toContain("text:시술 후:412:980")
    expect(text).toContain("text:시술 전:1188:980")
    expect(text).not.toContain("Session")
  })

  it("exports two cropped pictures and editable captions when PPTX alone is selected", async () => {
    // Given: PPTX only, after-first order.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      order: "afterBefore",
      selection: {
        png: false,
        individualPngs: false,
        pdf: false,
        pptx: true,
        html: false,
      },
    } as const
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: the real PPTX package contains two distinct cropped media objects and text shapes.
    const blob = requiredBlob(fixture.blobs)
    const entries = zipEntries(new Uint8Array(await blob.arrayBuffer()))
    const slide = decoder.decode(entries.get("ppt/slides/slide1.xml"))
    expect(blob.type).toBe(PPTX_MIME_TYPE)
    expect([...entries.keys()].filter((name) => name.startsWith("ppt/media/"))).toEqual([
      "ppt/media/image1.jpg",
      "ppt/media/image2.jpg",
    ])
    expect(slide.match(/<p:pic>/g)).toHaveLength(2)
    expect(slide.match(/<p:sp>/g)).toHaveLength(2)
    expect(slide).toContain("<a:t>시술 후</a:t>")
    expect(slide).toContain("<a:t>시술 전</a:t>")
    expect(slide.indexOf("<a:t>시술 후</a:t>")).toBeLessThan(slide.indexOf("<a:t>시술 전</a:t>"))
    expect(slide).not.toContain("Session")
    expect(decoder.decode(entries.get("ppt/media/image1.jpg"))).toContain("image:after-pixels")
    expect(decoder.decode(entries.get("ppt/media/image2.jpg"))).toContain("image:before-pixels")
    expect(fixture.canvases.map(({ width, height }) => [width, height])).toEqual([
      [752, 940],
      [752, 940],
    ])
    expect(
      fixture.canvases.flatMap(({ events }) => events).filter((event) => event.startsWith("text:")),
    ).toEqual([])
  })

  it("bundles only two cropped PNGs with semantic filenames when individual output is selected", async () => {
    // Given: individual images only, after-first order.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      order: "afterBefore",
      selection: {
        png: false,
        individualPngs: true,
        pdf: false,
        pptx: false,
        html: false,
      },
    } as const
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: one ZIP holds exactly two fresh 752×940 crops in the selected order.
    const blob = requiredBlob(fixture.blobs)
    const entries = zipEntries(new Uint8Array(await blob.arrayBuffer()))
    expect(blob.type).toBe("application/zip")
    expect([...entries.keys()]).toEqual([
      "Session-private- 7_01_after.png",
      "Session-private- 7_02_before.png",
    ])
    expect(fixture.canvases.map(({ width, height }) => [width, height])).toEqual([
      [752, 940],
      [752, 940],
    ])
    expect(decoder.decode(entries.get("Session-private- 7_01_after.png"))).toContain(
      "image:after-pixels",
    )
    expect(decoder.decode(entries.get("Session-private- 7_02_before.png"))).toContain(
      "image:before-pixels",
    )
    expect(fixture.anchor.click).toHaveBeenCalledTimes(1)
  })

  it("bundles exactly five generated artifacts when all outputs are selected", async () => {
    // Given: every format selected.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      selection: { png: true, individualPngs: true, pdf: true, pptx: true, html: false },
    }
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: one ZIP contains no extra source files or manifests.
    const entries = zipEntries(new Uint8Array(await requiredBlob(fixture.blobs).arrayBuffer()))
    expect([...entries.keys()].sort()).toEqual([
      "Session-private- 7_01_before.png",
      "Session-private- 7_02_after.png",
      "Session-private- 7_before-after.pdf",
      "Session-private- 7_before-after.png",
      "Session-private- 7_before-after.pptx",
    ])
    expect(fixture.anchor.download).toBe("Session-private- 7_before-after.zip")
    expect(fixture.anchor.click).toHaveBeenCalledTimes(1)
  })

  it("rejects before rendering when every output is disabled", async () => {
    // Given: an empty selection.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      selection: { png: false, individualPngs: false, pdf: false, pptx: false, html: false },
    }
    // When: export is attempted.
    await expect(
      exportComparison(comparisonExportPair, settings, fixture.dependencies),
    ).rejects.toBeInstanceOf(ComparisonCanvasError)
    // Then: neither canvas work nor download started.
    expect(fixture.canvases).toEqual([])
    expect(fixture.blobs).toEqual([])
  })

  it.each([
    [1, "PNG"],
    [2, "JPEG"],
  ] as const)(
    "does not download a partial bundle when encoding call %i fails",
    async (encodingFailsAt, format) => {
      // Given: all formats selected; the first PNG or the following JPEG encoding fails.
      const fixture = comparisonExportFixture({ encodingFailsAt })
      const settings = {
        ...defaults,
        selection: { png: true, individualPngs: true, pdf: true, pptx: true, html: false },
      }
      // When: export is attempted.
      await expect(
        exportComparison(comparisonExportPair, settings, fixture.dependencies),
      ).rejects.toThrow(`${format} encoding failed`)
      // Then: even previously encoded artifacts are not downloaded as a partial bundle.
      expect(fixture.blobs).toEqual([])
    },
  )

  it.each(["click", "anchor"] as const)(
    "revokes the artifact URL when %s creation fails",
    async (failure) => {
      // Given: a failure after the blob URL has been created.
      const fail = () => {
        throw new ComparisonCanvasError("download blocked")
      }
      const fixture = comparisonExportFixture(
        failure === "click" ? { click: fail } : { createDownloadAnchor: fail },
      )
      // When: download is attempted.
      await expect(
        exportComparison(comparisonExportPair, defaults, fixture.dependencies),
      ).rejects.toThrow("download blocked")
      // Then: the created URL is always reclaimed.
      expect(fixture.revokeObjectUrl).toHaveBeenCalledWith("blob:comparison-export")
    },
  )
})
