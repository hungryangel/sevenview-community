// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { photoId } from "../src/domain/types"
import {
  InspectorPhotoActions,
  useInspectorReplacement,
} from "../src/product/inspector-photo-actions"

afterEach(cleanup)
function Actions() {
  const replacement = useInspectorReplacement(() => undefined)
  return (
    <InspectorPhotoActions
      onAssignView={() => undefined}
      onRemoveToSpares={() => undefined}
      onReset={() => undefined}
      onResetAll={() => undefined}
      replacement={replacement}
      views={["front"]}
      photo={{
        adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
        assignmentMethod: "auto",
        image: document.createElement("canvas"),
        sourceSize: { width: 800, height: 1000 },
        view: "front",
        pose: {
          id: photoId("reset-confirmation"),
          anchor: { x: 0.5, y: 0.5 },
          bounds: { left: 0.2, top: 0.2, right: 0.8, bottom: 0.8 },
          confidence: 0.9,
          pitchScore: 0,
          rollDegrees: 0,
          yawScore: 0,
        },
      }}
    />
  )
}

it("cancels reset confirmation with Escape and restores the reset trigger", () => {
  // Given: an open reset confirmation, with focus on its safe action.
  render(<Actions />)
  const trigger = screen.getByRole("button", { name: "전체 기본값 재설정" })
  fireEvent.click(trigger)
  const cancel = screen.getByRole("button", { name: "취소" })
  expect(document.activeElement).toBe(cancel)
  // When: the operator cancels with Escape.
  fireEvent.keyDown(cancel, { key: "Escape" })
  // Then: only confirmation closes and focus returns to its trigger.
  expect(screen.queryByRole("alertdialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
