// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { useComparisonWorkspace } from "../src/product/use-comparison-workspace"
import { dependencies, ready, source } from "./support/comparison-workspace-fixtures"

afterEach(cleanup)

it("keeps recovery correspondences paired, preserves BEFORE, and separates ordinary point correction", async () => {
  const deps = dependencies(async (files) =>
    files.map((file, index) => ready(file, document.createElement("canvas"), index)),
  )
  const { result } = renderHook(() => useComparisonWorkspace(deps))
  act(() => {
    result.current.selectFile("before", source("before"))
    result.current.selectFile("after", source("after"))
  })
  await act(async () => result.current.analyze())
  const automatic = result.current.renderModel
  if (automatic?.kind !== "ready") throw new Error("Automatic fixture unavailable")
  act(() => result.current.setReference("before", "first", { x: 0.36, y: 0.4 }))
  // A generic AFTER recovery must not reuse a previous eye-based BEFORE edit.
  const vertical = { first: { x: 0.5, y: 0.2 }, second: { x: 0.5, y: 0.5 } }
  act(() => result.current.setReferences("after", vertical))
  expect(result.current.canExport).toBe(false)
  expect(result.current.renderModel).toMatchObject({ kind: "reviewRequired", side: "before" })
  act(() => result.current.setReferences("before", vertical))
  expect(result.current.renderModel).toMatchObject({
    kind: "ready",
    before: { instruction: { rotationDegrees: 0 } },
    after: { instruction: { rotationDegrees: 0 } },
  })
  // Replacing either file invalidates both generic correspondences, not their semantics.
  act(() => result.current.selectFile("after", source("replacement")))
  await act(async () => result.current.analyze())
  expect(result.current.canExport).toBe(false)
  expect(result.current.manualReferences).toEqual({})
  act(() => result.current.resetReferences())
  expect(result.current.canExport).toBe(true)
  // A normal single-marker correction remains available without entering recovery.
  act(() => result.current.setReference("after", "first", { x: 0.36, y: 0.4 }))
  expect(result.current.canExport).toBe(true)
  const edited = result.current.renderModel
  if (edited?.kind !== "ready") throw new Error("Direct editing failed")
  expect(edited.before.instruction).toEqual(automatic.before.instruction)
  expect(edited.after.instruction).not.toEqual(automatic.after.instruction)
  act(() => {
    result.current.setReferences("before", vertical)
    result.current.setReferences("after", vertical)
  })
  expect(result.current.canExport).toBe(true)
  expect(result.current.manualReferences).toEqual({ before: vertical, after: vertical })
  act(() => result.current.reset())
  expect(result.current.manualReferences).toEqual({})
  expect(result.current.renderModel).toBeNull()
})
