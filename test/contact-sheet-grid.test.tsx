// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { photoId } from "../src/domain/types"
import type { WorkspacePhoto } from "../src/domain/workspace"
import { ContactSheetGrid } from "../src/product/contact-sheet-grid"
import { InspectorSurface } from "../src/product/inspector-surface"

vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
afterEach(cleanup)

const photo: WorkspacePhoto<HTMLCanvasElement> = {
  adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
  assignmentMethod: "auto",
  image: document.createElement("canvas"),
  pose: {
    anchor: { x: 0.5, y: 0.5 },
    bounds: { bottom: 0.85, left: 0.25, right: 0.75, top: 0.15 },
    confidence: 0.94,
    id: photoId("contact-sheet-options"),
    pitchScore: 0,
    rollDegrees: 0,
    yawScore: 0,
  },
  sourceSize: { height: 1000, width: 800 },
  view: "front",
}

function grid(onSetReviewZoom: (zoom: number) => void) {
  return (
    <ContactSheetGrid
      failures={[]}
      framing={FRAMING_PRESETS.clinicalStandard}
      inspectorOpen={false}
      lateralityConflicts={[]}
      mismatchViews={[]}
      mixupViews={[]}
      onOpenInspector={() => undefined}
      onResetSelectedAdjustment={() => undefined}
      onSelect={() => undefined}
      onSetReviewAlignment={() => undefined}
      onSetReviewDisplayMode={() => undefined}
      onSetReviewZoom={onSetReviewZoom}
      onStartReview={null}
      photoMetaFor={() => undefined}
      photos={[photo]}
      reviewAlignment="aligned"
      reviewDisplayMode="grid"
      reviewZoom={1.15}
      selectedPhotoAdjusted={false}
      selectedView="front"
      selectedViewLabel="정면"
      views={["front"]}
    />
  )
}

function renderGrid() {
  const onSetReviewZoom = vi.fn()
  render(grid(onSetReviewZoom))
  return onSetReviewZoom
}

it("keeps advanced view options closed and preserves their controlled values when reopened", () => {
  const onSetReviewZoom = renderGrid()
  const trigger = screen.getByRole("button", { name: "보기 옵션" })
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByRole("group", { name: "보기 옵션" })).toBeNull()

  fireEvent.click(trigger)
  const options = screen.getByRole("group", { name: "보기 옵션" })
  expect(within(options).getByText("화면 확대")).toBeTruthy()
  expect(
    within(options).getByText("화면 확대는 보기만 바꾸며 저장 결과에 영향이 없습니다"),
  ).toBeTruthy()
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  expect(
    within(options).getByRole("button", { name: "AI 정렬" }).getAttribute("aria-pressed"),
  ).toBe("true")
  expect(
    within(options).getByRole<HTMLButtonElement>("button", { name: "미리보기 확대" }).disabled,
  ).toBe(true)
  fireEvent.click(within(options).getByRole("button", { name: "미리보기 맞춤" }))
  expect(onSetReviewZoom).toHaveBeenCalledWith(1)

  fireEvent.keyDown(within(options).getByRole("button", { name: "AI 정렬" }), { key: "Escape" })
  expect(screen.queryByRole("group", { name: "보기 옵션" })).toBeNull()
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(trigger)
  expect(screen.getByRole("button", { name: "AI 정렬" }).getAttribute("aria-pressed")).toBe("true")
})

it("shows screen guides by default without source editing context in result tiles", () => {
  // Given / When: the initial review grid is rendered.
  const { container } = render(grid(() => undefined))
  // Then: crop and center guides are visible, but source-only editor context is absent.
  expect(container.querySelector(".crop-editor-context")).toBeNull()
  expect(container.querySelector(".crop-preview__crop-guide")).not.toBeNull()
  expect(container.querySelector(".crop-preview__center-guide")).not.toBeNull()
  expect(container.querySelector(".crop-preview__eye-guide")).toBeNull()
})

it("lets view options own Escape without closing an open inspector", () => {
  const onInspectorClose = vi.fn()
  render(
    <main className="workspace-shell">
      <InspectorSurface onClose={onInspectorClose} onNext={null} onPrevious={null}>
        {grid(() => undefined)}
      </InspectorSurface>
    </main>,
  )
  fireEvent.click(screen.getByRole("button", { name: "보기 옵션" }))
  const option = screen.getByRole("button", { name: "AI 정렬" })
  option.focus()

  fireEvent.keyDown(option, { key: "Escape" })

  expect(screen.queryByRole("group", { name: "보기 옵션" })).toBeNull()
  expect(onInspectorClose).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "보기 옵션" }))
})
