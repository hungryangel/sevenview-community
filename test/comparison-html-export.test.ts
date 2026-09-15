import { describe, expect, it } from "vitest"
import { exportComparison } from "../src/adapters/comparison-export"
import { createComparisonExportSettings } from "../src/domain/comparison-export"
import {
  comparisonExportFixture,
  comparisonExportPair,
  requiredBlob,
  zipEntries,
} from "./support/comparison-export-fixtures"

const defaults = createComparisonExportSettings("Session/private: 7")

describe("comparison HTML export integration", () => {
  it("downloads one HTML document directly when HTML is the only output", async () => {
    // Given: only the offline HTML presentation is selected.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      selection: { png: false, individualPngs: false, pdf: false, pptx: false, html: true },
    }
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: the standalone document has the browser HTML MIME type and safe filename.
    expect(requiredBlob(fixture.blobs).type).toBe("text/html;charset=utf-8")
    expect(fixture.anchor.download).toBe("Session-private- 7_before-after.html")
  })

  it("embeds the final crops once in selected presentation order", async () => {
    // Given: HTML only with AFTER presented first.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      order: "afterBefore",
      selection: { png: false, individualPngs: false, pdf: false, pptx: false, html: true },
    } as const
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: two 752×940 final-crop PNGs appear in the requested semantic order.
    expect(fixture.canvases.map(({ width, height }) => [width, height])).toEqual([
      [752, 940],
      [752, 940],
    ])
    const html = await requiredBlob(fixture.blobs).text()
    const encodedCrops = await Promise.all(
      fixture.canvases.map(async ({ width, height, events }) => {
        const bytes = new Uint8Array(
          await new Blob([JSON.stringify({ width, height, events })]).arrayBuffer(),
        )
        let binary = ""
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return btoa(binary)
      }),
    )
    expect(html.indexOf(encodedCrops[0] ?? "missing-after")).toBeGreaterThanOrEqual(0)
    expect(html.indexOf(encodedCrops[0] ?? "missing-after")).toBeLessThan(
      html.indexOf(encodedCrops[1] ?? "missing-before"),
    )
    expect(fixture.canvases[0]?.events).toContain("image:after-pixels")
    expect(fixture.canvases[1]?.events).toContain("image:before-pixels")
  })

  it("does not expose the session name or raw source handles in HTML", async () => {
    // Given: identifying text exists only at the filename and fake source boundaries.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      selection: { png: false, individualPngs: false, pdf: false, pptx: false, html: true },
    }
    // When: the HTML document is built.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: those names and raw source handles are absent from document markup.
    const html = await requiredBlob(fixture.blobs).text()
    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html).not.toContain("Session/private: 7")
    expect(html).not.toContain("before-pixels")
    expect(html).not.toContain("after-pixels")
  })

  it("bundles paired PNG and HTML as exactly one ZIP", async () => {
    // Given: pair PNG and HTML are selected together.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      selection: { png: true, individualPngs: false, pdf: false, pptx: false, html: true },
    }
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: one ZIP contains exactly those two outputs.
    const entries = zipEntries(new Uint8Array(await requiredBlob(fixture.blobs).arrayBuffer()))
    expect([...entries.keys()]).toEqual([
      "Session-private- 7_before-after.png",
      "Session-private- 7_before-after.html",
    ])
    expect(requiredBlob(fixture.blobs).type).toBe("application/zip")
    expect(fixture.anchor.download).toBe("Session-private- 7_before-after.zip")
  })

  it("reuses each PNG encoding when individual PNGs and HTML are selected", async () => {
    // Given: both consumers need the same two final-crop PNGs.
    const fixture = comparisonExportFixture()
    const settings = {
      ...defaults,
      selection: { png: false, individualPngs: true, pdf: false, pptx: false, html: true },
    }
    // When: the comparison is exported.
    await exportComparison(comparisonExportPair, settings, fixture.dependencies)
    // Then: each crop is encoded once and reused for both outputs.
    expect(fixture.getEncodingCount()).toBe(2)
    expect([
      ...zipEntries(new Uint8Array(await requiredBlob(fixture.blobs).arrayBuffer())).keys(),
    ]).toEqual([
      "Session-private- 7_01_before.png",
      "Session-private- 7_02_after.png",
      "Session-private- 7_before-after.html",
    ])
  })

  it("does not download HTML when a final crop fails to encode", async () => {
    // Given: HTML only and the second final-crop PNG encoding fails.
    const fixture = comparisonExportFixture({ encodingFailsAt: 2 })
    const settings = {
      ...defaults,
      selection: { png: false, individualPngs: false, pdf: false, pptx: false, html: true },
    }
    // When: export is attempted.
    await expect(
      exportComparison(comparisonExportPair, settings, fixture.dependencies),
    ).rejects.toThrow("PNG encoding failed")
    // Then: no empty or partial HTML file is downloaded.
    expect(fixture.blobs).toEqual([])
  })
})
