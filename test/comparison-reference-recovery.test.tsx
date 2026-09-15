// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ComparisonReferenceRecovery } from "../src/product/comparison-reference-recovery"

afterEach(cleanup)

describe("ComparisonReferenceRecovery", () => {
  it("keeps incomplete coordinates as drafts and maps pointer placement through contain geometry", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recovery")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    const onChange = vi.fn()
    render(
      <ComparisonReferenceRecovery
        file={new File(["x"], "x.png")}
        onChange={onChange}
        side="before"
        sourceSize={{ height: 1000, width: 500 }}
      />,
    )
    const target = screen.getByRole("button", { name: /원본에서 기준점 1/ })
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      bottom: 500,
      height: 500,
      left: 0,
      right: 250,
      top: 0,
      width: 250,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    fireEvent.pointerDown(target, { clientX: 125, clientY: 250 })
    const apply = screen.getByRole("button", { name: "기준점 적용" })
    if (!(apply instanceof HTMLButtonElement)) throw new Error("Apply button missing")
    expect(apply.disabled).toBe(true)
    const inputs = screen.getAllByRole("spinbutton")
    const secondX = inputs[2]
    const secondY = inputs[3]
    if (secondX === undefined || secondY === undefined) throw new Error("Coordinates missing")
    fireEvent.change(secondX, { target: { value: "0.6" } })
    expect(apply.disabled).toBe(true)
    fireEvent.change(secondY, { target: { value: "0.7" } })
    fireEvent.click(screen.getByRole("button", { name: "기준점 적용" }))
    expect(onChange).toHaveBeenCalledWith({ first: { x: 0.5, y: 0.5 }, second: { x: 0.6, y: 0.7 } })
  })
})
