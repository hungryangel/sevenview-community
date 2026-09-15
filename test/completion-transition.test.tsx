// @vitest-environment jsdom

import { act, render, renderHook, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { advanceAnalysisJourney, beginAnalysisJourney } from "../src/domain/analysis-journey"
import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { photoId } from "../src/domain/types"
import { DEFAULT_CROP_ADJUSTMENT } from "../src/domain/workspace"
import { CompletionTransition } from "../src/product/completion-transition"
import { useAnalysisPresentation } from "../src/product/use-analysis-presentation"

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
  Object.defineProperty(document, "hidden", { configurable: true, value: false })
})

describe("CompletionTransition", () => {
  it("does not replay a newer generation after it became inactive", () => {
    const hook = renderHook(
      ({ active, generation }) =>
        useAnalysisPresentation({ active, generation, ready: true, revision: 1 }),
      { initialProps: { active: true, generation: 1 } },
    )
    expect(hook.result.current.canAnimate).toBe(true)
    hook.rerender({ active: true, generation: 2 })
    expect(hook.result.current.canAnimate).toBe(true)
    act(() => hook.rerender({ active: false, generation: 2 }))
    act(() => hook.rerender({ active: true, generation: 2 }))
    expect(hook.result.current.canAnimate).toBe(false)
  })

  it("keeps the new generation snapshot so a later manual revision stays static", () => {
    const hook = renderHook(
      ({ generation, revision }) =>
        useAnalysisPresentation({ active: true, generation, ready: true, revision }),
      { initialProps: { generation: 1, revision: 1 } },
    )
    hook.rerender({ generation: 2, revision: 1 })
    expect(hook.result.current.canAnimate).toBe(true)
    hook.rerender({ generation: 2, revision: 2 })
    expect(hook.result.current.canAnimate).toBe(false)
  })

  it("animates the first ready revision of a generation, then keeps later edits static", () => {
    const hook = renderHook(
      ({ generation, ready, revision }) =>
        useAnalysisPresentation({ active: true, generation, ready, revision }),
      { initialProps: { generation: 1, ready: true, revision: 1 } },
    )
    hook.rerender({ generation: 2, ready: false, revision: 1 })
    expect(hook.result.current.canAnimate).toBe(false)
    hook.rerender({ generation: 2, ready: true, revision: 2 })
    expect(hook.result.current.canAnimate).toBe(true)
    hook.rerender({ generation: 2, ready: true, revision: 3 })
    expect(hook.result.current.canAnimate).toBe(false)
  })

  it("does not defer a first-ready presentation until after a hidden tab returns", () => {
    const hook = renderHook(
      ({ ready, revision }) =>
        useAnalysisPresentation({ active: true, generation: 2, ready, revision }),
      { initialProps: { ready: false, revision: 1 } },
    )
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    hook.rerender({ ready: true, revision: 2 })
    expect(hook.result.current.canAnimate).toBe(false)

    Object.defineProperty(document, "hidden", { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    hook.rerender({ ready: true, revision: 2 })
    expect(hook.result.current.canAnimate).toBe(false)
  })

  it("keeps an initially hidden ready generation static after the tab returns", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    const hook = renderHook(() =>
      useAnalysisPresentation({ active: true, generation: 2, ready: true, revision: 1 }),
    )
    expect(hook.result.current.canAnimate).toBe(false)

    Object.defineProperty(document, "hidden", { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    hook.rerender()
    expect(hook.result.current.canAnimate).toBe(false)
  })

  it("never gates the ready result when no valid crop can be presented", () => {
    const detecting = advanceAnalysisJourney(beginAnalysisJourney(1, 1), {
      type: "itemDetected",
      generation: 1,
      index: 0,
    })
    const complete = advanceAnalysisJourney(
      advanceAnalysisJourney(detecting, { type: "settled", generation: 1 }),
      { type: "completed", generation: 1 },
    )
    render(
      <CompletionTransition active journey={complete}>
        <button type="button">내보내기</button>
      </CompletionTransition>,
    )

    expect(screen.getByRole("button", { name: "내보내기" })).not.toHaveProperty("disabled", true)
    expect(screen.queryByRole("button", { name: "전환 건너뛰기" })).toBeNull()
    expect(screen.queryByRole("button", { name: "다시 보기" })).toBeNull()
    expect(screen.getByRole("status").classList.contains("sr-only")).toBe(true)
    expect(screen.getByText(/자동 크롭 없음/)).not.toBeNull()
  })

  it("stays static with reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }))
    const complete = {
      ...beginAnalysisJourney(2, 1),
      kind: "complete" as const,
    }
    const { container } = render(
      <CompletionTransition
        active
        items={[
          {
            framing: FRAMING_PRESETS.clinicalStandard,
            photo: {
              adjustment: DEFAULT_CROP_ADJUSTMENT,
              assignmentMethod: "auto",
              image: document.createElement("canvas"),
              pose: {
                anchor: { x: 0.5, y: 0.5 },
                bounds: { bottom: 0.8, left: 0.2, right: 0.8, top: 0.2 },
                confidence: 0.9,
                id: photoId("reduced-motion"),
                pitchScore: 0,
                rollDegrees: 0,
                yawScore: 0,
              },
              sourceSize: { height: 1000, width: 800 },
              view: "front",
            },
          },
        ]}
        journey={complete}
      >
        <span>완성 프레임</span>
      </CompletionTransition>,
    )
    expect(container.querySelector(".completion-transition__presentation")).toBeNull()
    expect(screen.getByText("완성 프레임")).not.toBeNull()
  })
})
