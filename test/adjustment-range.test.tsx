// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { InspectorControl } from "../src/ui/inspector-control"
import { RotationControl } from "../src/ui/rotation-control"

afterEach(cleanup)

function controls() {
  render(
    <>
      <InspectorControl
        defaultValue={0}
        label="가로 위치"
        min={-20}
        max={20}
        step={1}
        unit="%"
        value={0}
        onChange={() => undefined}
        onReset={() => undefined}
      />
      <RotationControl
        min={-12}
        max={12}
        value={0}
        onChange={() => undefined}
        onReset={() => undefined}
      />
    </>,
  )
  return screen.getAllByRole("slider")
}

it("clears the pointer highlight after release without highlighting another adjustment", () => {
  // Given: two independent adjustment sliders.
  const [position, rotation] = controls()
  if (position === undefined || rotation === undefined)
    throw new TypeError("Missing adjustment slider")
  fireEvent.pointerDown(position)
  fireEvent.focus(position)
  expect(position.getAttribute("data-adjusting")).toBe("true")
  // When: the operator releases the pointer.
  fireEvent.pointerUp(position)
  // Then: neither slider retains the interaction highlight.
  expect(position.getAttribute("data-adjusting")).toBe("false")
  expect(rotation.getAttribute("data-adjusting")).toBe("false")
})

it("highlights the keyboard-focused adjustment until focus leaves", () => {
  // Given: the rotation slider is reached by keyboard.
  const [, rotation] = controls()
  if (rotation === undefined) throw new TypeError("Missing rotation slider")
  fireEvent.focus(rotation)
  expect(rotation.getAttribute("data-adjusting")).toBe("true")
  // When: keyboard focus moves away.
  fireEvent.blur(rotation)
  // Then: the range returns to its resting appearance.
  expect(rotation.getAttribute("data-adjusting")).toBe("false")
})
