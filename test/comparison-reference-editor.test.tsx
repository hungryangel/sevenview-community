// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ComparisonReferenceEditor } from "../src/product/comparison-reference-editor"
import { editorModel, previewBounds } from "./support/comparison-editor-fixture"

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixture")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setup() {
  const props = {
    model: editorModel(),
    onReferenceChange: vi.fn(),
    onResetReferences: vi.fn(),
    onResidualChange: vi.fn(),
  }
  const rendered = render(<ComparisonReferenceEditor {...props} />)
  const disclosure = screen.getByText("기준점·위치 조정").parentElement
  if (!(disclosure instanceof HTMLDetailsElement)) throw new Error("missing disclosure")
  fireEvent.click(screen.getByText("기준점·위치 조정"))
  fireEvent(disclosure, new Event("toggle"))
  return { ...props, ...rendered, disclosure }
}

describe("source reference editing", () => {
  it("keeps normalized number fields out of the default editor", () => {
    // Given the opened direct editor.
    setup()
    // When inspecting its primary input surface.
    const fields = screen.queryAllByRole("spinbutton")
    // Then source editing uses semantic markers.
    expect(fields).toHaveLength(0)
    expect(screen.getByRole("button", { name: "시술 전 화면 왼쪽 눈 기준점 1" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "시술 후 화면 오른쪽 눈 기준점 2" })).toBeTruthy()
  })

  it("commits a keyboard marker edit in normalized source coordinates", () => {
    // Given the first real source point.
    const { onReferenceChange } = setup()
    // When moving it one keyboard step to the right.
    fireEvent.keyDown(screen.getByRole("button", { name: "시술 전 화면 왼쪽 눈 기준점 1" }), {
      key: "ArrowRight",
    })
    // Then the semantic source and point stay attached to the edit.
    expect(onReferenceChange).toHaveBeenCalledWith("before", "first", { x: 0.351, y: 0.4 })
  })

  it("maps source drag to its original frame", () => {
    // Given a source frame with different screen dimensions.
    const { onReferenceChange } = setup()
    const marker = screen.getByRole("button", { name: "시술 전 화면 왼쪽 눈 기준점 1" })
    const frame = marker.parentElement
    if (frame === null) throw new Error("missing frame")
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(previewBounds)
    // When dragging the marker to the lower right.
    fireEvent.pointerDown(marker, { clientX: 240, clientY: 250, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 400, clientY: 450, pointerId: 1 })
    // Then source coordinates follow the frame bounds.
    expect(onReferenceChange).toHaveBeenCalledWith("before", "first", { x: 0.75, y: 0.8 })
  })

  it("does not commit a cancelled pointer on its later release", () => {
    // Given a pressed source marker.
    const { onReferenceChange } = setup()
    const marker = screen.getByRole("button", { name: "시술 전 화면 왼쪽 눈 기준점 1" })
    const frame = marker.parentElement
    if (frame === null) throw new Error("missing frame")
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(previewBounds)
    fireEvent.pointerDown(marker, { clientX: 240, clientY: 250, pointerId: 1 })
    // When the pointer cancels and subsequently releases over the marker.
    fireEvent.pointerCancel(window, { pointerId: 1 })
    fireEvent.pointerUp(marker, { clientX: 400, clientY: 450, pointerId: 1 })
    // Then the cancelled gesture causes no mutation.
    expect(onReferenceChange).not.toHaveBeenCalled()
  })

  it("resets source references independently of residual adjustment", () => {
    // Given editable automatic references.
    const { onResetReferences, onResidualChange } = setup()
    // When requesting their reset.
    fireEvent.click(screen.getByRole("button", { name: "자동 기준점으로 재설정" }))
    // Then only reference reset is requested.
    expect(onResetReferences).toHaveBeenCalledOnce()
    expect(onResidualChange).not.toHaveBeenCalled()
  })
})
