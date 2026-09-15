import { describe, expect, it } from "vitest"
import {
  buildComparisonExportFilename,
  buildComparisonIndividualFilename,
  countComparisonExportArtifacts,
  createComparisonExportSettings,
  DEFAULT_COMPARISON_EXPORT_SELECTION,
  hasComparisonExportOutput,
} from "../src/domain/comparison-export"

describe("comparison export settings", () => {
  it("uses only paired PNG and before-first order when settings are created", () => {
    // Given: a caller-provided session name.
    const sessionName = "2026-09-06_0900"
    // When: comparison export settings are created.
    const settings = createComparisonExportSettings(sessionName)
    // Then: the comparison defaults are independent of contact-sheet settings.
    expect(settings).toEqual({
      sessionName,
      selection: { png: true, individualPngs: false, pdf: false, pptx: false, html: false },
      order: "beforeAfter",
    })
    expect(DEFAULT_COMPARISON_EXPORT_SELECTION).toEqual(settings.selection)
  })

  it.each([
    [{ png: true, individualPngs: false, pdf: false, pptx: false, html: false }, "png", 1],
    [{ png: false, individualPngs: false, pdf: true, pptx: false, html: false }, "pdf", 1],
    [{ png: false, individualPngs: false, pdf: false, pptx: true, html: false }, "pptx", 1],
    [{ png: false, individualPngs: false, pdf: false, pptx: false, html: true }, "html", 1],
    [{ png: false, individualPngs: true, pdf: false, pptx: false, html: false }, "zip", 2],
    [{ png: true, individualPngs: true, pdf: true, pptx: true, html: true }, "zip", 6],
  ] as const)("previews the one download when outputs are %j", (selection, extension, count) => {
    // Given: a name containing separators and a selected output combination.
    const settings = { sessionName: "  Follow/up: A  ", selection, order: "afterBefore" } as const
    // When: the filename preview is requested.
    const filename = buildComparisonExportFilename(settings)
    // Then: the preview matches the actual single artifact or bundle.
    expect(filename).toBe(`Follow-up- A_before-after.${extension}`)
    expect(countComparisonExportArtifacts(selection)).toBe(count)
    expect(hasComparisonExportOutput(selection)).toBe(true)
  })

  it("marks an empty selection unavailable when all formats are disabled", () => {
    // Given: no requested format.
    const selection = { png: false, individualPngs: false, pdf: false, pptx: false, html: false }
    // When: availability is checked.
    const available = hasComparisonExportOutput(selection)
    // Then: no download can start.
    expect(available).toBe(false)
    expect(countComparisonExportArtifacts(selection)).toBe(0)
  })

  it("keeps the semantic slot in individual names when order is reversed", () => {
    // Given: the after image is first.
    const settings = { ...createComparisonExportSettings("pair"), order: "afterBefore" } as const
    // When: its filename is generated.
    const filename = buildComparisonIndividualFilename(settings, "after")
    // Then: numbering follows presentation order while the slot remains after.
    expect(filename).toBe("pair_01_after.png")
  })

  it("uses a safe fallback when the edited name contains only filename separators", () => {
    // Given: an edited name that sanitizes to empty.
    const settings = createComparisonExportSettings(" /:*?<>| ")
    // When: the filename preview is requested.
    const filename = buildComparisonExportFilename(settings)
    // Then: a usable filename remains.
    expect(filename).toBe("sevenview_before-after.png")
  })
})
