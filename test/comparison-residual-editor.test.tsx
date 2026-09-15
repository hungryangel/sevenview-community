// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ComparisonReferenceEditor } from "../src/product/comparison-reference-editor"
import { EMPTY_COMPARISON_ADJUSTMENT } from "../src/product/comparison-render-model"
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
  const surface = screen.getByRole("button", { name: "시술 후 사진 위치 직접 조정" })
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(previewBounds)
  return { props, ...rendered, disclosure, surface }
}

describe("live after-image correction", () => {
  it.each(["mouse", "touch"])("moves the after crop right and up during %s drag", (pointerType) => {
    // Given the aligned overlay at its default crop.
    const { props, surface } = setup()
    // When dragging right by 20px and up by 25px on a 400×500 preview.
    fireEvent.pointerDown(surface, { clientX: 300, clientY: 300, pointerId: 2, pointerType })
    fireEvent.pointerMove(window, { clientX: 320, clientY: 275, pointerId: 2, pointerType })
    // Then the saved adjustment follows the image with positive-up Y.
    expect(props.onResidualChange).toHaveBeenLastCalledWith({
      ...EMPTY_COMPARISON_ADJUSTMENT,
      panX: 0.05,
      panY: 0.05,
    })
  })

  it("moves the crop with keyboard access to the same image surface", () => {
    // Given a focusable direct-manipulation surface.
    const { props, surface } = setup()
    // When the up arrow is pressed.
    fireEvent.keyDown(surface, { key: "ArrowUp" })
    // Then the stored crop moves upward by a fine step.
    expect(props.onResidualChange).toHaveBeenCalledWith({
      ...EMPTY_COMPARISON_ADJUSTMENT,
      panY: 0.001,
    })
  })

  it.each(["inactive", "busy", "closed", "cancelled"])(
    "cancels a drag when the editor becomes %s",
    (reason) => {
      // Given a pressed preview with no movement yet.
      const { surface, rerender, disclosure, props } = setup()
      fireEvent.pointerDown(surface, { clientX: 300, clientY: 300, pointerId: 2 })
      // When editing is interrupted and pointer events continue.
      if (reason === "inactive") rerender(<ComparisonReferenceEditor {...props} active={false} />)
      if (reason === "busy") rerender(<ComparisonReferenceEditor {...props} disabled />)
      if (reason === "closed") {
        disclosure.open = false
        fireEvent(disclosure, new Event("toggle"))
      }
      if (reason === "cancelled") fireEvent.pointerCancel(window, { pointerId: 2 })
      fireEvent.pointerMove(window, { clientX: 320, clientY: 275, pointerId: 2 })
      fireEvent.pointerUp(window, { clientX: 320, clientY: 275, pointerId: 2 })
      // Then no late crop edit is committed.
      expect(props.onResidualChange).not.toHaveBeenCalled()
    },
  )

  it("converts readable crop percentages to the saved multiplier", () => {
    // Given the precision controls.
    const { props } = setup()
    // When crop scale is set to 112%.
    fireEvent.change(screen.getByRole("slider", { name: "비교 배율" }), {
      target: { value: "112" },
    })
    // Then it edits saved crop scale.
    expect(props.onResidualChange).toHaveBeenCalledWith({
      ...EMPTY_COMPARISON_ADJUSTMENT,
      scaleMultiplier: 1.12,
    })
  })

  it("resets only residual correction", () => {
    // Given an edited crop.
    const { rerender, props } = setup()
    rerender(
      <ComparisonReferenceEditor
        {...props}
        model={editorModel({ ...EMPTY_COMPARISON_ADJUSTMENT, panX: 0.05 })}
      />,
    )
    // When resetting image position and crop.
    fireEvent.click(screen.getByRole("button", { name: "위치·회전·배율 재설정" }))
    // Then registration references remain untouched.
    expect(props.onResidualChange).toHaveBeenCalledWith(EMPTY_COMPARISON_ADJUSTMENT)
    expect(props.onResetReferences).not.toHaveBeenCalled()
  })
})
