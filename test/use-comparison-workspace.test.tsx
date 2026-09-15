// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ComparisonWorkspaceDependencies } from "../src/product/use-comparison-workspace"
import { useComparisonWorkspace } from "../src/product/use-comparison-workspace"
import { dependencies, ready, source } from "./support/comparison-workspace-fixtures"

afterEach(cleanup)

describe("useComparisonWorkspace", () => {
  it("records real stage callbacks and returns originals to pending on cancel", async () => {
    const before = source("before")
    const after = source("after")
    let capturedSignal: AbortSignal | undefined
    const deps = dependencies(async (files, _onProgress, runtime) => {
      capturedSignal = runtime?.signal
      const item = ready(files[0] ?? before, document.createElement("canvas"), 1)
      runtime?.onStage?.({ index: 0, item, kind: "analyzed" })
      await new Promise<void>((_resolve, reject) => {
        runtime?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("cancelled", "AbortError")),
          { once: true },
        )
      })
      return []
    })
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    let analysis: Promise<void>
    act(() => {
      analysis = result.current.analyzePending()
    })
    await act(async () => Promise.resolve())
    expect(result.current.journey).toMatchObject({
      kind: "detecting",
      items: [{ index: 0, anchors: expect.any(Object) }],
    })
    act(() => result.current.cancelAnalysis())
    await act(async () => analysis)
    expect(capturedSignal?.aborted).toBe(true)
    expect(result.current.session.before.kind).toBe("pending")
    expect(result.current.session.after.kind).toBe("pending")
    expect(result.current.journey.kind).toBe("cancelled")
  })

  it("announces the active side in Before then After order", async () => {
    const before = source("before")
    const after = source("after")
    let reportFirst: (() => void) | undefined
    let finish: (() => void) | undefined
    const deps = dependencies(async (files, onProgress) => {
      await new Promise<void>((resolve) => {
        reportFirst = resolve
      })
      onProgress?.(1, 2)
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      onProgress?.(2, 2)
      return [
        ready(files[0] ?? before, document.createElement("canvas"), 1),
        ready(files[1] ?? after, document.createElement("canvas"), 2),
      ]
    })
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })

    let analysis: Promise<void> | undefined
    act(() => {
      analysis = result.current.analyzePending()
    })
    expect(result.current.analysisSide).toBe("before")
    await act(async () => reportFirst?.())
    expect(result.current.analysisSide).toBe("after")
    await act(async () => {
      finish?.()
      await analysis
    })
    expect(result.current.analysisSide).toBeNull()
    act(() => result.current.setReference("before", "first", { x: 0.25, y: 0.3 }))
    expect(result.current.renderModel).toMatchObject({
      kind: "ready",
      before: { provenance: "manual" },
    })
  })

  it("changes the shared angle without rerunning analysis", () => {
    const analyzeFiles = vi.fn<ComparisonWorkspaceDependencies["analyzeFiles"]>()
    const { result } = renderHook(() => useComparisonWorkspace(dependencies(analyzeFiles)))
    act(() => result.current.setAngle("leftProfile"))
    expect(result.current.angle).toBe("leftProfile")
    expect(analyzeFiles).not.toHaveBeenCalled()
  })

  it.each(["before", "after"] as const)(
    "analyzes only a replaced %s side while retaining the other ready side",
    async (side) => {
      const before = source("before")
      const after = source("after")
      const replacement = source(`${side}-replacement`)
      const beforeImage = document.createElement("canvas")
      const afterImage = document.createElement("canvas")
      const replacementImage = document.createElement("canvas")
      const analyzeFiles = vi
        .fn<ComparisonWorkspaceDependencies["analyzeFiles"]>()
        .mockResolvedValueOnce([ready(before, beforeImage, 1), ready(after, afterImage, 2)])
        .mockResolvedValueOnce([ready(replacement, replacementImage, 1)])
      const deps = dependencies(analyzeFiles)
      const { result, unmount } = renderHook(() => useComparisonWorkspace(deps))
      act(() => {
        result.current.selectFile("before", before)
        result.current.selectFile("after", after)
      })
      await act(async () => result.current.analyzePending())
      act(() => result.current.selectFile(side, replacement))
      expect(result.current.canAnalyze).toBe(true)
      await act(async () => result.current.analyzePending())
      expect(analyzeFiles.mock.calls[1]?.[0]).toEqual([replacement])
      expect(result.current.session.before.kind).toBe("ready")
      expect(result.current.session.after.kind).toBe("ready")
      expect(result.current.session[side]).toMatchObject({ file: replacement })
      expect(deps.releaseImage).toHaveBeenCalledTimes(1)
      expect(deps.releaseImage).toHaveBeenCalledWith(side === "before" ? beforeImage : afterImage)
      unmount()
      expect(deps.releaseImage).toHaveBeenCalledTimes(3)
      expect(deps.releasePreviewUrl).toHaveBeenCalledTimes(3)
    },
  )

  it("keeps Before ready when After fails and closes only the failed decoded bitmap", async () => {
    const before = source("before")
    const after = source("after")
    const beforeImage = document.createElement("canvas")
    const failedImage = document.createElement("canvas")
    const afterImage = document.createElement("canvas")
    const analyzeFiles = vi
      .fn<ComparisonWorkspaceDependencies["analyzeFiles"]>()
      .mockResolvedValueOnce([
        ready(before, beforeImage, 1),
        {
          kind: "error",
          file: after,
          code: "face_not_detected",
          decoded: { image: failedImage, width: 800, height: 1000 },
        },
      ])
      .mockResolvedValueOnce([ready(after, afterImage, 1)])
    const deps = dependencies(analyzeFiles)
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyze())
    expect(result.current.session.before.kind).toBe("ready")
    expect(result.current.session.after.kind).toBe("error")
    expect(result.current.canExport).toBe(false)
    await act(async () => result.current.retry("after"))
    expect(analyzeFiles.mock.calls[1]?.[0]).toEqual([after])
    expect(deps.releaseImage).toHaveBeenCalledTimes(1)
    expect(deps.releaseImage).toHaveBeenCalledWith(failedImage)
    expect(deps.releasePreviewUrl.mock.calls).toEqual([["blob:1"], ["blob:2"]])
    expect(result.current.session.before.kind).toBe("ready")
    expect(result.current.session.after.kind).toBe("ready")
    expect(result.current.canExport).toBe(true)
  })

  it("analyzes a replacement for the failed side while retaining the ready side", async () => {
    const before = source("before")
    const after = source("after")
    const replacement = source("after-replacement")
    const beforeImage = document.createElement("canvas")
    const replacementImage = document.createElement("canvas")
    const analyzeFiles = vi
      .fn<ComparisonWorkspaceDependencies["analyzeFiles"]>()
      .mockResolvedValueOnce([
        ready(before, beforeImage, 1),
        { kind: "error", file: after, code: "face_not_detected", decoded: null },
      ])
      .mockResolvedValueOnce([ready(replacement, replacementImage, 1)])
    const deps = dependencies(analyzeFiles)
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyzePending())
    act(() => result.current.selectFile("after", replacement))
    await act(async () => result.current.analyzePending())
    expect(analyzeFiles.mock.calls[1]?.[0]).toEqual([replacement])
    expect(result.current.session.before).toMatchObject({ kind: "ready", file: before })
    expect(result.current.session.after).toMatchObject({ kind: "ready", file: replacement })
    expect(deps.releaseImage).not.toHaveBeenCalled()
    expect(deps.releasePreviewUrl.mock.calls).toEqual([["blob:1"], ["blob:2"], ["blob:3"]])
  })

  it("turns a malformed short batch into an explicit side error without stale analyzing state", async () => {
    const before = source("before")
    const after = source("after")
    const beforeImage = document.createElement("canvas")
    const deps = dependencies(async () => [ready(before, beforeImage, 1)])
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyze())
    expect(result.current.session.before.kind).toBe("ready")
    expect(result.current.session.after).toMatchObject({
      kind: "error",
      code: "analysis_failed",
      file: after,
    })
    expect(result.current.canExport).toBe(false)
  })
})
