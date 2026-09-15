// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { useComparisonWorkspace } from "../src/product/use-comparison-workspace"
import { dependencies, source } from "./support/comparison-workspace-fixtures"

afterEach(cleanup)

function setup() {
  const before = source("before")
  const after = source("after")
  const images = [document.createElement("canvas"), document.createElement("canvas")]
  const deps = {
    ...dependencies(async () =>
      [before, after].map((file, index) => ({
        kind: "error" as const,
        file,
        code: "face_not_detected" as const,
        decoded: {
          image: images[index] ?? document.createElement("canvas"),
          width: 400,
          height: 500,
        },
      })),
    ),
    exportFiles: vi.fn(async (_pair, _settings, shouldDownload: () => boolean) =>
      shouldDownload() ? ("downloaded" as const) : ("stale" as const),
    ),
  }
  const hook = renderHook(() => useComparisonWorkspace(deps))
  act(() => {
    hook.result.current.selectFile("before", before)
    hook.result.current.selectFile("after", after)
  })
  return { ...hook, deps, images }
}

it("retains failed face images for explicit manual recovery without inventing a pose", async () => {
  // Given decoded images whose detector returned no face.
  const { result, deps, unmount } = setup()
  await act(async () => result.current.analyze())
  // When the user explicitly chooses manual registration.
  act(() => result.current.beginManual("before"))
  // Then no automatic pose or export readiness is fabricated.
  expect(result.current.session.before).toMatchObject({ kind: "manual" })
  expect(result.current.session.before).not.toHaveProperty("pose")
  expect(result.current.canExport).toBe(false)
  expect(deps.releaseImage).not.toHaveBeenCalled()
  unmount()
  expect(deps.releaseImage).toHaveBeenCalledTimes(2)
  expect(deps.releasePreviewUrl).toHaveBeenCalledTimes(2)
})

it("exports manual profile registration only after direction and both real reference pairs are confirmed", async () => {
  // Given a pair that could not be automatically detected.
  const { result, deps } = setup()
  await act(async () => result.current.analyze())
  act(() => {
    result.current.beginManual("before")
    result.current.beginManual("after")
  })
  expect(result.current.canExport).toBe(false)
  act(() => result.current.setAngle("rightProfile"))
  const references = { first: { x: 0.5, y: 0.35 }, second: { x: 0.65, y: 0.5 } }
  act(() => result.current.setReferences("before", references))
  expect(result.current.canExport).toBe(false)
  act(() => result.current.setReferences("after", references))
  // When the user saves the valid manual pair.
  await act(async () => result.current.exportComparison())
  // Then manual provenance is kept and identical profile sources remain unrotated.
  expect(result.current.renderModel).toMatchObject({
    kind: "ready",
    before: { provenance: "manual", instruction: { rotationDegrees: 0 } },
    after: { provenance: "manual", instruction: { rotationDegrees: 0 } },
  })
  expect(deps.exportFiles).toHaveBeenCalledOnce()
  expect(result.current.exported).toBe(true)
})

it("does not enter manual mode for decode failures", async () => {
  const before = source("broken")
  const deps = dependencies(async () => [
    { kind: "error", file: before, code: "decode_failed", decoded: null },
  ])
  const { result } = renderHook(() => useComparisonWorkspace(deps))
  act(() => {
    result.current.selectFile("before", before)
    result.current.selectFile("after", source("after"))
  })
  await act(async () => result.current.analyze())
  act(() => result.current.beginManual("before"))
  expect(result.current.session.before.kind).toBe("error")
  expect(result.current.canExport).toBe(false)
})

it("releases retained failed and manual images on retry, removal and reset exactly once", async () => {
  // Given an unsuccessful local detection retaining both decoded images.
  const { result, deps, unmount } = setup()
  await act(async () => result.current.analyze())
  // When one side retries with a freshly decoded image.
  const retriedImage = document.createElement("canvas")
  deps.analyzeFiles = vi.fn(async (files: readonly File[]) =>
    files.map((file) => ({
      kind: "error" as const,
      file,
      code: "face_not_detected" as const,
      decoded: { image: retriedImage, width: 400, height: 500 },
    })),
  )
  await act(async () => result.current.retry("before"))
  expect(deps.releaseImage).toHaveBeenCalledTimes(1)
  act(() => {
    result.current.beginManual("before")
    result.current.removeSide("before")
  })
  expect(deps.releaseImage).toHaveBeenCalledTimes(2)
  act(() => result.current.reset())
  expect(deps.releaseImage).toHaveBeenCalledTimes(3)
  unmount()
  // Then unmount does not release the removed images again.
  expect(deps.releaseImage).toHaveBeenCalledTimes(3)
})
