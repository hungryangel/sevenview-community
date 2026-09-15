// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ComparisonWorkspaceDependencies } from "../src/product/use-comparison-workspace"
import { useComparisonWorkspace } from "../src/product/use-comparison-workspace"
import type { PhotoBatchItem } from "../src/services/analyze-batch"
import { dependencies, ready, source } from "./support/comparison-workspace-fixtures"

afterEach(cleanup)

describe("useComparisonWorkspace races", () => {
  it("releases every superseded pending replacement once and analyzes only the latest", async () => {
    const before = source("before")
    const after = source("after")
    const firstReplacement = source("replacement-one")
    const finalReplacement = source("replacement-two")
    const beforeImage = document.createElement("canvas")
    const afterImage = document.createElement("canvas")
    const finalImage = document.createElement("canvas")
    const analyzeFiles = vi
      .fn<ComparisonWorkspaceDependencies["analyzeFiles"]>()
      .mockResolvedValueOnce([ready(before, beforeImage, 1), ready(after, afterImage, 2)])
      .mockResolvedValueOnce([ready(finalReplacement, finalImage, 1)])
    const deps = dependencies(analyzeFiles)
    const { result, unmount } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyzePending())

    act(() => {
      result.current.selectFile("before", firstReplacement)
      result.current.selectFile("before", finalReplacement)
    })
    await act(async () => result.current.analyzePending())

    expect(analyzeFiles.mock.calls[1]?.[0]).toEqual([finalReplacement])
    expect(deps.releaseImage.mock.calls).toEqual([[beforeImage]])
    expect(deps.releasePreviewUrl.mock.calls).toEqual([
      ["blob:1"],
      ["blob:2"],
      ["blob:3"],
      ["blob:4"],
    ])
    unmount()
    expect(deps.releaseImage.mock.calls).toEqual([[beforeImage], [finalImage], [afterImage]])
  })

  it("cancels the full generation when Before is replaced during two-side analysis", async () => {
    const before = source("before")
    const after = source("after")
    const replacement = source("replacement")
    const staleBeforeImage = document.createElement("canvas")
    const staleAfterImage = document.createElement("canvas")
    let finish: ((items: readonly PhotoBatchItem<CanvasImageSource>[]) => void) | undefined
    const deps = dependencies(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { result, unmount } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    let pending: Promise<void>
    act(() => {
      pending = result.current.analyze()
    })

    act(() => result.current.selectFile("before", replacement))
    await act(async () => {
      finish?.([ready(before, staleBeforeImage, 1), ready(after, staleAfterImage, 2)])
      await pending
    })

    expect(result.current.session.before).toMatchObject({ kind: "pending", file: replacement })
    expect(result.current.session.after).toMatchObject({ kind: "pending", file: after })
    expect(result.current.journey.kind).toBe("cancelled")
    expect(deps.releaseImage.mock.calls).toEqual([[staleBeforeImage], [staleAfterImage]])
    expect(deps.releasePreviewUrl.mock.calls).toEqual([["blob:1"]])
    unmount()
    expect(deps.releaseImage.mock.calls).toEqual([[staleBeforeImage], [staleAfterImage]])
    expect(deps.releasePreviewUrl.mock.calls).toEqual([["blob:1"], ["blob:3"], ["blob:2"]])
  })

  it("cancels an After-only retry when Before is replaced while retry is in flight", async () => {
    const before = source("before")
    const after = source("after")
    const replacement = source("replacement")
    const beforeImage = document.createElement("canvas")
    const afterImage = document.createElement("canvas")
    let finishRetry: ((items: readonly PhotoBatchItem<CanvasImageSource>[]) => void) | undefined
    const analyzeFiles = vi
      .fn<ComparisonWorkspaceDependencies["analyzeFiles"]>()
      .mockResolvedValueOnce([
        ready(before, beforeImage, 1),
        { kind: "error", file: after, code: "face_not_detected", decoded: null },
      ])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRetry = resolve
          }),
      )
    const deps = dependencies(analyzeFiles)
    const { result, unmount } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyze())
    let retry: Promise<void>
    act(() => {
      retry = result.current.retry("after")
    })

    act(() => result.current.selectFile("before", replacement))
    await act(async () => {
      finishRetry?.([ready(after, afterImage, 1)])
      await retry
    })

    expect(result.current.session.before).toMatchObject({ kind: "pending", file: replacement })
    expect(result.current.session.after).toMatchObject({ kind: "pending", file: after })
    expect(result.current.journey.kind).toBe("cancelled")
    expect(deps.releaseImage.mock.calls).toEqual([[beforeImage], [afterImage]])
    expect(deps.releasePreviewUrl.mock.calls).toEqual([["blob:1"]])
    unmount()
    expect(deps.releaseImage.mock.calls).toEqual([[beforeImage], [afterImage]])
    expect(deps.releasePreviewUrl.mock.calls).toEqual([["blob:1"], ["blob:3"], ["blob:2"]])
  })
})
