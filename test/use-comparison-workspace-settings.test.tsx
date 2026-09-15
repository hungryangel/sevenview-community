// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createComparisonExportSettings } from "../src/domain/comparison-export"
import {
  type ComparisonWorkspaceDependencies,
  useComparisonWorkspace,
} from "../src/product/use-comparison-workspace"
import { dependencies, ready, source } from "./support/comparison-workspace-fixtures"

const { recordUsageEvent } = vi.hoisted(() => ({ recordUsageEvent: vi.fn() }))
vi.mock("../src/usage/usage-events", () => ({ recordUsageEvent }))

afterEach(() => {
  cleanup()
  recordUsageEvent.mockReset()
})

async function readyWorkspace(
  exportFiles: NonNullable<ComparisonWorkspaceDependencies["exportFiles"]>,
) {
  const before = source("before")
  const after = source("after")
  const beforeImage = document.createElement("canvas")
  const afterImage = document.createElement("canvas")
  const exportPng = vi.fn(async (_pair, _now, shouldDownload: () => boolean) =>
    shouldDownload() ? ("downloaded" as const) : ("stale" as const),
  )
  const deps = {
    ...dependencies(async () => [ready(before, beforeImage, 1), ready(after, afterImage, 2)]),
    exportFiles,
    exportPng,
  }
  const rendered = renderHook(() => useComparisonWorkspace(deps))
  act(() => {
    rendered.result.current.selectFile("before", before)
    rendered.result.current.selectFile("after", after)
  })
  await act(async () => rendered.result.current.analyze())
  return { ...rendered, beforeImage, afterImage, exportPng }
}

describe("comparison workspace export settings", () => {
  it("does not count a rejected non-image selection as app use", () => {
    // Given: a comparison workspace and a non-image file.
    const { result } = renderHook(() => useComparisonWorkspace(dependencies(async () => [])))

    // When: the file reaches the existing selection boundary.
    act(() => result.current.selectFile("before", new File(["text"], "note.txt")))

    // Then: it is not counted as an accepted photo.
    expect(recordUsageEvent).not.toHaveBeenCalledWith("app_use")
  })

  it("creates date-based defaults and restores fresh metadata when reset", () => {
    // Given an initialized workspace with edited export metadata and a manual angle.
    let currentTime = new Date(2026, 8, 6, 10, 11)
    const deps = { ...dependencies(async () => []), now: () => currentTime }
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    expect(result.current.exportSettings).toEqual(createComparisonExportSettings("2026-09-06_1011"))
    act(() => {
      result.current.setExportSettings({
        ...createComparisonExportSettings("edited"),
        order: "afterBefore",
      })
      result.current.setAngle("leftProfile")
    })
    currentTime = new Date(2026, 8, 6, 11, 12)
    // When the session is reset.
    act(() => result.current.reset())
    // Then metadata is fresh and angle inference returns to automatic mode.
    expect(result.current.exportSettings).toEqual(createComparisonExportSettings("2026-09-06_1112"))
    expect(result.current.angleOverride).toBeNull()
  })

  it("clears the prior save status when export settings change", async () => {
    // Given an exported comparison with retained ready photos.
    const before = source("before")
    const after = source("after")
    const deps = {
      ...dependencies(async () => [
        ready(before, document.createElement("canvas"), 1),
        ready(after, document.createElement("canvas"), 2),
      ]),
      exportPng: vi.fn(async (_pair, _now, shouldDownload: () => boolean) =>
        shouldDownload() ? ("downloaded" as const) : ("stale" as const),
      ),
    }
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyze())
    await act(async () => result.current.exportComparison())
    expect(result.current.exported).toBe(true)
    // When metadata changes for the next export.
    act(() => result.current.setExportSettings(createComparisonExportSettings("renamed")))
    // Then success from the previous settings is no longer presented as current.
    expect(result.current.exported).toBe(false)
    expect(result.current.exportMessage).toBeNull()
    expect(result.current.renderModel?.kind).toBe("ready")
    expect(recordUsageEvent).toHaveBeenCalledWith("app_use")
    expect(recordUsageEvent).toHaveBeenCalledWith("export_complete")
  })

  it("passes selected export settings without changing source identities", async () => {
    // Given a ready pair with a filename, reversed export order, and several selected formats.
    const exportFiles = vi.fn<NonNullable<ComparisonWorkspaceDependencies["exportFiles"]>>(
      async (_pair, _settings, shouldDownload) => (shouldDownload() ? "downloaded" : "stale"),
    )
    const { result, beforeImage, afterImage, exportPng } = await readyWorkspace(exportFiles)
    const settings = {
      sessionName: "custom session",
      order: "afterBefore",
      selection: { png: true, individualPngs: true, pdf: true, pptx: true, html: false },
    } as const
    act(() => result.current.setExportSettings(settings))
    // When saving the configured export.
    await act(async () => result.current.exportComparison())
    // Then the multi-format adapter receives the settings and the original before/after roles.
    expect(exportFiles).toHaveBeenCalledTimes(1)
    expect(exportFiles.mock.calls[0]?.[1]).toEqual(settings)
    expect(exportFiles.mock.calls[0]?.[0].before.image).toBe(beforeImage)
    expect(exportFiles.mock.calls[0]?.[0].after.image).toBe(afterImage)
    expect(exportPng).not.toHaveBeenCalled()
  })

  it("retains the save snapshot while withholding stale success after a rename", async () => {
    // Given an export that is still encoding under the original settings.
    let settle: (() => void) | undefined
    const exportFiles = vi.fn<NonNullable<ComparisonWorkspaceDependencies["exportFiles"]>>(
      (_pair, _settings, shouldDownload) =>
        new Promise((resolve) => {
          settle = () => resolve(shouldDownload() ? "downloaded" : "stale")
        }),
    )
    const { result } = await readyWorkspace(exportFiles)
    const original = createComparisonExportSettings("original")
    act(() => result.current.setExportSettings(original))
    let saving: Promise<void> | undefined
    act(() => {
      saving = result.current.exportComparison()
    })
    // When the name changes before the earlier export settles.
    act(() => result.current.setExportSettings(createComparisonExportSettings("renamed")))
    await act(async () => {
      settle?.()
      await saving
    })
    // Then the stale artifact is withheld and does not mark the renamed export as saved.
    expect(exportFiles.mock.calls[0]?.[1]).toEqual(original)
    expect(result.current.exportSettings.sessionName).toBe("renamed")
    expect(result.current.exportCount).toBe(0)
    expect(result.current.exported).toBe(false)
    expect(result.current.exportMessage).toBeNull()
    expect(recordUsageEvent).not.toHaveBeenCalledWith("export_complete")
  })

  it("keeps settings accessible but refuses export when every output is unchecked", async () => {
    // Given a ready pair with no output format selected.
    const exportFiles = vi.fn<NonNullable<ComparisonWorkspaceDependencies["exportFiles"]>>(
      async (_pair, _settings, shouldDownload) => (shouldDownload() ? "downloaded" : "stale"),
    )
    const { result } = await readyWorkspace(exportFiles)
    act(() =>
      result.current.setExportSettings({
        ...createComparisonExportSettings("empty"),
        selection: { png: false, individualPngs: false, pdf: false, pptx: false, html: false },
      }),
    )
    // When export is invoked directly despite the empty selection.
    await act(async () => result.current.exportComparison())
    // Then settings can reopen while the adapter receives no invalid export request.
    expect(result.current.canExport).toBe(true)
    expect(exportFiles).not.toHaveBeenCalled()
    expect(result.current.exporting).toBe(false)
    expect(result.current.exportCount).toBe(0)
  })
})
