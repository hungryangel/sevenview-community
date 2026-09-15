// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ComparisonSession } from "../src/domain/comparison-session"
import { photoId } from "../src/domain/types"
import { useComparisonEyePrivacy } from "../src/product/use-comparison-eye-privacy"

const file = (name: string) => new File([name], name, { type: "image/jpeg" })
const ready = (source: File, image: CanvasImageSource) => ({
  kind: "ready" as const,
  file: source,
  decoded: { image, width: 800, height: 1000 },
  pose: {
    id: photoId(source.name),
    anchor: { x: 0.5, y: 0.5 },
    bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
    confidence: 0.9,
    pitchScore: 0,
    rollDegrees: 0,
    yawScore: 0,
  },
})

describe("comparison eye privacy lifecycle", () => {
  it("is off by default and fails closed when enabled without two reviewed masks", () => {
    const beforeFile = file("before.jpg")
    const afterFile = file("after.jpg")
    const session: ComparisonSession<CanvasImageSource> = {
      phase: "review",
      before: ready(beforeFile, document.createElement("canvas")),
      after: ready(afterFile, document.createElement("canvas")),
    }
    const clearExportStatus = vi.fn()
    const { result } = renderHook(() =>
      useComparisonEyePrivacy({
        active: true,
        busy: false,
        clearExportStatus,
        generations: { before: 1, after: 1 },
        session,
      }),
    )

    expect(result.current.enabled).toBe(false)
    act(() => result.current.setEnabled(true))
    expect(result.current.complete).toBe(false)
    expect(result.current.canExport).toBe(false)
    expect(clearExportStatus).toHaveBeenCalledTimes(1)
  })

  it("commits a valid draft only to the exact source generation and drops it on replacement", () => {
    const beforeFile = file("before.jpg")
    const afterFile = file("after.jpg")
    const image = document.createElement("canvas")
    const initial: ComparisonSession<CanvasImageSource> = {
      phase: "review",
      before: ready(beforeFile, image),
      after: ready(afterFile, document.createElement("canvas")),
    }
    const { result, rerender } = renderHook(
      ({ busy, generation, session }) =>
        useComparisonEyePrivacy({
          active: true,
          busy,
          clearExportStatus: vi.fn(),
          generations: { before: generation, after: 1 },
          session,
        }),
      { initialProps: { busy: false, generation: 1, session: initial } },
    )
    act(() => {
      result.current.beginEdit("before")
      result.current.setDraft({ left: 0.2, top: 0.3, right: 0.8, bottom: 0.5 })
    })
    let applied = false
    act(() => {
      applied = result.current.applyDraft()
    })
    expect(applied).toBe(true)
    expect(result.current.masks.before?.provenance).toBe("manual")

    const replacement: ComparisonSession<CanvasImageSource> = {
      ...initial,
      before: ready(file("new-before.jpg"), document.createElement("canvas")),
    }
    rerender({ busy: false, generation: 2, session: replacement })
    expect(result.current.masks.before).toBeNull()

    act(() => result.current.beginEdit("before"))
    rerender({ busy: true, generation: 2, session: replacement })
    expect(result.current.applyDraft()).toBe(false)
  })
})
