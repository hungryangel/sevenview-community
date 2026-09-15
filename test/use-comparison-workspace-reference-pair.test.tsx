// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ComparisonReferencePair } from "../src/domain/comparison-reference-pair"
import { isRenderableComparisonSlot } from "../src/domain/comparison-session"
import type { ReadyComparisonSlot } from "../src/product/comparison-preview"
import {
  type ComparisonWorkspaceDependencies,
  useComparisonWorkspace,
} from "../src/product/use-comparison-workspace"
import { dependencies, ready, source } from "./support/comparison-workspace-fixtures"

afterEach(cleanup)

const REFERENCES: ComparisonReferencePair = {
  before: { first: { x: 0.3, y: 0.4 }, second: { x: 0.7, y: 0.4 } },
  after: { first: { x: 0.32, y: 0.42 }, second: { x: 0.68, y: 0.42 } },
}

function renderablePair(session: ReturnType<typeof useComparisonWorkspace>["session"]): {
  readonly before: ReadyComparisonSlot
  readonly after: ReadyComparisonSlot
} {
  if (!isRenderableComparisonSlot(session.before) || !isRenderableComparisonSlot(session.after)) {
    throw new TypeError("Expected a renderable comparison pair")
  }
  return { before: session.before, after: session.after }
}

async function prepareReady(
  exportFiles?: NonNullable<ComparisonWorkspaceDependencies["exportFiles"]>,
) {
  const before = source("reference-before")
  const after = source("reference-after")
  const deps = {
    ...dependencies(async () => [
      ready(before, document.createElement("canvas"), 1),
      ready(after, document.createElement("canvas"), 2),
    ]),
    ...(exportFiles === undefined ? {} : { exportFiles }),
  }
  const hook = renderHook(() => useComparisonWorkspace(deps))
  act(() => {
    hook.result.current.selectFile("before", before)
    hook.result.current.selectFile("after", after)
  })
  await act(async () => hook.result.current.analyzePending())
  return { ...hook, deps }
}

describe("useComparisonWorkspace paired reference application", () => {
  it("commits both references, angle, residual reset, revision, and export status once", async () => {
    // Given a saved current pair with a previous residual correction.
    const exportFiles = vi.fn<NonNullable<ComparisonWorkspaceDependencies["exportFiles"]>>()
    const { result } = await prepareReady(exportFiles)
    const pair = renderablePair(result.current.session)
    act(() =>
      result.current.setResidual({
        panX: 0.1,
        panY: -0.1,
        rotationDegrees: 2,
        scaleMultiplier: 1.1,
      }),
    )
    await act(async () => result.current.exportComparison())
    const revisionBefore = result.current.renderModel?.revision

    // When the complete pair is applied.
    let applied = false
    act(() => {
      applied = result.current.applyReferencePair(pair, REFERENCES, "leftProfile")
    })

    // Then the full alignment changes in one revision and the stale save status is cleared.
    expect(applied).toBe(true)
    expect(result.current.renderModel).toMatchObject({
      kind: "ready",
      revision: (revisionBefore ?? 0) + 1,
      residual: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
      before: { provenance: "manual" },
      after: { provenance: "manual" },
    })
    expect(result.current.angleOverride).toBe("leftProfile")
    expect(result.current.manualReferences).toEqual(REFERENCES)
    expect(result.current.exported).toBe(false)
  })

  it("adopts retained no-face images without releasing them", async () => {
    // Given two decoded detector failures represented by the editor as manual slots.
    const before = source("manual-before")
    const after = source("manual-after")
    const beforeDecoded = { image: document.createElement("canvas"), width: 800, height: 1000 }
    const afterDecoded = { image: document.createElement("canvas"), width: 800, height: 1000 }
    const deps = dependencies(async () => [
      { kind: "error", file: before, code: "face_not_detected", decoded: beforeDecoded },
      { kind: "error", file: after, code: "face_not_detected", decoded: afterDecoded },
    ])
    const { result } = renderHook(() => useComparisonWorkspace(deps))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyzePending())
    const pair = {
      before: { kind: "manual", file: before, decoded: beforeDecoded },
      after: { kind: "manual", file: after, decoded: afterDecoded },
    } as const
    // When the matching retained pair is applied.
    let applied = false
    act(() => {
      applied = result.current.applyReferencePair(pair, REFERENCES, "front")
    })

    // Then ownership moves to manual slots and the decoded images remain live.
    expect(applied).toBe(true)
    expect(result.current.session.before).toMatchObject({ kind: "manual", decoded: beforeDecoded })
    expect(result.current.session.after).toMatchObject({ kind: "manual", decoded: afterDecoded })
    expect(result.current.renderModel).toMatchObject({ kind: "ready" })
    expect(deps.releaseImage).not.toHaveBeenCalled()
    expect(deps.releasePreviewUrl.mock.calls).toEqual([["blob:1"], ["blob:2"]])
  })

  it("rejects a stale pair after either current source identity changes", async () => {
    // Given a pair snapshot whose Before source has since been replaced.
    const { result } = await prepareReady()
    const stalePair = renderablePair(result.current.session)
    act(() => result.current.selectFile("before", source("replacement")))

    // When the stale editor attempts to apply.
    let applied = true
    act(() => {
      applied = result.current.applyReferencePair(stalePair, REFERENCES, "front")
    })

    // Then no alignment state is published.
    expect(applied).toBe(false)
    expect(result.current.manualReferences).toEqual({})
    expect(result.current.session.before.kind).toBe("pending")
  })

  it("rejects non-finite, out-of-range, or unsolved reference geometry", async () => {
    // Given the current pair and invalid manual point sets.
    const { result } = await prepareReady()
    const pair = renderablePair(result.current.session)
    const invalidReferences: readonly ComparisonReferencePair[] = [
      {
        before: { first: { x: 0.5, y: 0.5 }, second: { x: 0.5, y: 0.5 } },
        after: REFERENCES.after,
      },
      {
        before: { first: { x: -0.1, y: 0.4 }, second: { x: 0.7, y: 0.4 } },
        after: REFERENCES.after,
      },
      {
        before: { first: { x: Number.NaN, y: 0.4 }, second: { x: 0.7, y: 0.4 } },
        after: REFERENCES.after,
      },
    ]
    const revisionBefore = result.current.renderModel?.revision

    // When each invalid geometry is submitted, it remains the automatic current result.
    for (const invalid of invalidReferences) {
      let applied = true
      act(() => {
        applied = result.current.applyReferencePair(pair, invalid, "front")
      })
      expect(applied).toBe(false)
    }
    expect(result.current.manualReferences).toEqual({})
    expect(result.current.renderModel).toMatchObject({ kind: "ready", revision: revisionBefore })
  })

  it("rejects application while the workspace is inactive or externally busy", async () => {
    // Given a current pair and a handler retained before the workspace becomes busy.
    const before = source("guard-before")
    const after = source("guard-after")
    const deps = dependencies(async () => [
      ready(before, document.createElement("canvas"), 1),
      ready(after, document.createElement("canvas"), 2),
    ])
    const hook = renderHook(({ active, busy }) => useComparisonWorkspace(deps, active, busy), {
      initialProps: { active: true, busy: false },
    })
    act(() => {
      hook.result.current.selectFile("before", before)
      hook.result.current.selectFile("after", after)
    })
    await act(async () => hook.result.current.analyzePending())
    const pair = renderablePair(hook.result.current.session)
    const retainedApply = hook.result.current.applyReferencePair
    hook.rerender({ active: true, busy: true })

    // When the retained handler is called, then the latest handler is called while inactive.
    const busyApplied = retainedApply(pair, REFERENCES, "front")
    hook.rerender({ active: false, busy: false })
    const inactiveApplied = hook.result.current.applyReferencePair(pair, REFERENCES, "front")

    // Then both requests are synchronously rejected using current runtime guards.
    expect(busyApplied).toBe(false)
    expect(inactiveApplied).toBe(false)
    expect(hook.result.current.manualReferences).toEqual({})
  })

  it("rejects application synchronously after export starts", async () => {
    // Given a current pair and an export that has not settled.
    let settle: (() => void) | undefined
    const exportFiles = vi.fn<NonNullable<ComparisonWorkspaceDependencies["exportFiles"]>>(
      (_pair, _settings, shouldDownload) =>
        new Promise((resolve) => {
          settle = () => resolve(shouldDownload() ? "downloaded" : "stale")
        }),
    )
    const { result } = await prepareReady(exportFiles)
    const pair = renderablePair(result.current.session)
    let exporting: Promise<void>
    let applied = true

    // When export and reference application are requested in the same render turn.
    act(() => {
      exporting = result.current.exportComparison()
      applied = result.current.applyReferencePair(pair, REFERENCES, "front")
    })

    // Then the private in-flight guard rejects the mutation before React state catches up.
    expect(applied).toBe(false)
    expect(result.current.manualReferences).toEqual({})
    await act(async () => {
      settle?.()
      await exporting
    })
  })

  it("rejects application while a retained side is being analyzed", async () => {
    // Given retained detector failures and an in-flight retry.
    const before = source("retry-before")
    const after = source("retry-after")
    const beforeDecoded = { image: document.createElement("canvas"), width: 800, height: 1000 }
    const afterDecoded = { image: document.createElement("canvas"), width: 800, height: 1000 }
    let settle: (() => void) | undefined
    const analyzeFiles = vi
      .fn<ComparisonWorkspaceDependencies["analyzeFiles"]>()
      .mockResolvedValueOnce([
        { kind: "error", file: before, code: "face_not_detected", decoded: beforeDecoded },
        { kind: "error", file: after, code: "face_not_detected", decoded: afterDecoded },
      ])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settle = () =>
              resolve([
                {
                  kind: "error",
                  file: before,
                  code: "face_not_detected",
                  decoded: {
                    image: document.createElement("canvas"),
                    width: 800,
                    height: 1000,
                  },
                },
              ])
          }),
      )
    const { result } = renderHook(() => useComparisonWorkspace(dependencies(analyzeFiles)))
    act(() => {
      result.current.selectFile("before", before)
      result.current.selectFile("after", after)
    })
    await act(async () => result.current.analyzePending())
    const pair = {
      before: { kind: "manual", file: before, decoded: beforeDecoded },
      after: { kind: "manual", file: after, decoded: afterDecoded },
    } as const
    let retrying: Promise<void>
    let applied = true

    // When retry and reference application are requested in the same render turn.
    act(() => {
      retrying = result.current.retry("before")
      applied = result.current.applyReferencePair(pair, REFERENCES, "front")
    })

    // Then the synchronous session phase rejects the mutation.
    expect(applied).toBe(false)
    expect(result.current.manualReferences).toEqual({})
    await act(async () => {
      settle?.()
      await retrying
    })
  })
})
