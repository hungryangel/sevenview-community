// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ComparisonViewerStage } from "../src/product/comparison-viewer-stage"
import { editorModel, previewBounds } from "./support/comparison-editor-fixture"

beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("physical comparison divider", () => {
  it.each(["beforeAfter", "afterBefore"] as const)(
    "moves the boundary right when the range increases with %s order",
    (order) => {
      // Given a comparison at its midpoint.
      render(
        <ComparisonViewerStage
          informationMode="off"
          mode="wipe"
          model={editorModel()}
          order={order}
        />,
      )
      // When the user moves the range to 75%.
      fireEvent.change(screen.getByRole("slider", { name: "비교 경계 위치" }), {
        target: { value: "75" },
      })
      // Then both clip geometry and the visible handle lie at the same physical x.
      expect(
        document.querySelector<HTMLElement>(".comparison-viewer__wipe-after")?.style.clipPath,
      ).toBe(order === "beforeAfter" ? "inset(0 0 0 75%)" : "inset(0 25% 0 0)")
      expect(screen.getByRole("slider", { name: "사진 위 비교 경계" }).style.left).toBe("75%")
    },
  )

  it("preserves the boundary when presentation order changes", () => {
    // Given a boundary at 75%.
    const model = editorModel()
    const { rerender } = render(
      <ComparisonViewerStage informationMode="off" mode="wipe" model={model} order="beforeAfter" />,
    )
    fireEvent.change(screen.getByRole("slider", { name: "비교 경계 위치" }), {
      target: { value: "75" },
    })
    // When the order changes.
    rerender(
      <ComparisonViewerStage informationMode="off" mode="wipe" model={model} order="afterBefore" />,
    )
    // Then the after image switches sides without mirroring the boundary.
    expect(screen.getByRole("slider", { name: "사진 위 비교 경계" }).style.left).toBe("75%")
    expect(
      document.querySelector<HTMLElement>(".comparison-viewer__wipe-after")?.style.clipPath,
    ).toBe("inset(0 25% 0 0)")
  })

  it.each(["mouse", "touch"])("drags the physical divider through %s input", (pointerType) => {
    // Given the actual preview bounds.
    render(
      <ComparisonViewerStage
        informationMode="off"
        mode="wipe"
        model={editorModel()}
        order="beforeAfter"
      />,
    )
    const divider = screen.getByRole("slider", { name: "사진 위 비교 경계" })
    const frame = divider.parentElement
    if (frame === null) throw new Error("missing frame")
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(previewBounds)
    // When the pointer moves to 80% inside the frame.
    fireEvent.pointerDown(divider, { clientX: 300, clientY: 250, pointerId: 1, pointerType })
    fireEvent.pointerMove(window, { clientX: 420, clientY: 250, pointerId: 1, pointerType })
    // Then the range and boundary agree at that screen position.
    expect(screen.getByRole<HTMLInputElement>("slider", { name: "비교 경계 위치" }).value).toBe(
      "80",
    )
    expect(divider.style.left).toBe("80%")
  })

  it("stops dragging when the pointer is cancelled", () => {
    // Given an active drag.
    render(
      <ComparisonViewerStage
        informationMode="off"
        mode="wipe"
        model={editorModel()}
        order="beforeAfter"
      />,
    )
    const divider = screen.getByRole("slider", { name: "사진 위 비교 경계" })
    const frame = divider.parentElement
    if (frame === null) throw new Error("missing frame")
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(previewBounds)
    fireEvent.pointerDown(divider, { clientX: 300, clientY: 250, pointerId: 1 })
    // When cancelled and the same pointer continues moving.
    fireEvent.pointerCancel(window, { pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 420, clientY: 250, pointerId: 1 })
    // Then the boundary no longer moves.
    expect(divider.style.left).toBe("50%")
  })

  it.each(["inactive", "busy"])("stops the divider gesture when %s", (reason) => {
    // Given a pressed divider.
    const model = editorModel()
    const props = { informationMode: "off", mode: "wipe", model, order: "beforeAfter" } as const
    const { rerender } = render(<ComparisonViewerStage {...props} />)
    const divider = screen.getByRole("slider", { name: "사진 위 비교 경계" })
    const frame = divider.parentElement
    if (frame === null) throw new Error("missing frame")
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(previewBounds)
    fireEvent.pointerDown(divider, { clientX: 300, clientY: 250, pointerId: 1 })
    // When the workflow locks and the old pointer continues.
    rerender(
      <ComparisonViewerStage
        {...props}
        active={reason !== "inactive"}
        disabled={reason === "busy"}
      />,
    )
    fireEvent.pointerMove(window, { clientX: 420, clientY: 250, pointerId: 1 })
    // Then the boundary remains fixed and leaves keyboard order.
    expect(divider.style.left).toBe("50%")
    expect(divider.tabIndex).toBe(-1)
  })

  it.each([
    ["ArrowRight", "51%"],
    ["Home", "0%"],
    ["End", "100%"],
  ] as const)("moves the visible handle with %s", (key, position) => {
    // Given a keyboard-focused handle.
    render(
      <ComparisonViewerStage
        informationMode="off"
        mode="wipe"
        model={editorModel()}
        order="beforeAfter"
      />,
    )
    const divider = screen.getByRole("slider", { name: "사진 위 비교 경계" })
    divider.focus()
    // When its movement key is pressed.
    fireEvent.keyDown(divider, { key })
    // Then visible geometry moves, including the endpoints.
    expect(divider.style.left).toBe(position)
    expect(
      document.querySelector<HTMLElement>(".comparison-viewer__wipe-after")?.style.clipPath,
    ).toBe(`inset(0 0 0 ${position})`)
  })
})
