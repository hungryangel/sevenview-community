// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useComparisonWorkspace } from "../src/product/use-comparison-workspace"
import { dependencies, ready, source } from "./support/comparison-workspace-fixtures"

afterEach(cleanup)

function setup(beforeYaw: number, afterYaw: number) {
  const before = source("before")
  const after = source("after")
  const deps = dependencies(async () =>
    [before, after].map((file, index) => {
      const item = ready(file, document.createElement("canvas"), index)
      if (item.kind !== "ready") return item
      return { ...item, pose: { ...item.pose, yawScore: index === 0 ? beforeYaw : afterYaw } }
    }),
  )
  const rendered = renderHook(() => useComparisonWorkspace(deps))
  act(() => {
    rendered.result.current.selectFile("before", before)
    rendered.result.current.selectFile("after", after)
  })
  return rendered
}

describe("comparison workspace angle resolution", () => {
  it("starts in automatic mode and resolves matching lateral photos after analysis", async () => {
    // Given two right-oblique photos with no manual override.
    const { result } = setup(0.4, 0.5)
    expect(result.current.angleOverride).toBeNull()
    expect(result.current.angleResolution).toBeNull()
    // When both photos finish analysis.
    await act(async () => result.current.analyze())
    // Then the model uses the inferred right-oblique angle.
    expect(result.current.angle).toBe("rightOblique")
    expect(result.current.angleResolution).toMatchObject({ kind: "ready", provenance: "automatic" })
    expect(result.current.renderModel?.kind).toBe("ready")
  })

  it("withholds rendering and export until a mismatched pair gets a manual angle", async () => {
    // Given photos from different inferred angle categories.
    const { result } = setup(0.4, -0.8)
    await act(async () => result.current.analyze())
    expect(result.current.angleResolution).toMatchObject({
      kind: "reviewRequired",
      reason: "angle_mismatch",
    })
    expect(result.current.renderModel).toBeNull()
    expect(result.current.canExport).toBe(false)
    // When the user explicitly confirms a comparison angle.
    act(() => result.current.setAngle("rightOblique"))
    // Then inferred source labels remain visible while the model becomes available.
    expect(result.current.angleResolution).toMatchObject({
      kind: "ready",
      before: "rightOblique",
      after: "leftProfile",
      provenance: "manual",
    })
    expect(result.current.renderModel?.kind).toBe("ready")
  })

  it("returns a manually resolved mismatch to review when automatic mode is restored", async () => {
    // Given a manually confirmed mismatched pair.
    const { result } = setup(0.4, -0.8)
    await act(async () => result.current.analyze())
    act(() => result.current.setAngle("front"))
    // When the override is cleared.
    act(() => result.current.setAngle(null))
    // Then the mismatch is reviewed again and stale render instructions disappear.
    expect(result.current.angleOverride).toBeNull()
    expect(result.current.angleResolution?.kind).toBe("reviewRequired")
    expect(result.current.renderModel).toBeNull()
  })
})
