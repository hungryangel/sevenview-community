// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { photoId } from "../src/domain/types"
import { ComparisonEyeMaskEditor } from "../src/product/comparison-eye-mask-editor"
import { ComparisonEyePrivacyControl } from "../src/product/comparison-eye-privacy-control"
import {
  buildComparisonRenderModel,
  EMPTY_COMPARISON_ADJUSTMENT,
} from "../src/product/comparison-render-model"
import type { ComparisonEyePrivacyController } from "../src/product/use-comparison-eye-privacy"

vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
afterEach(cleanup)

const image = document.createElement("canvas")
const detected = {
  provenance: "detected" as const,
  regions: [{ left: 0.2, top: 0.3, right: 0.45, bottom: 0.5 }],
}
const pair = (name: "before" | "after") => ({
  kind: "ready" as const,
  file: new File([name], `${name}.jpg`, { type: "image/jpeg" }),
  decoded: { image, width: 800, height: 1000 },
  pose: {
    id: photoId(name),
    anchor: { x: 0.5, y: 0.5 },
    bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
    confidence: 0.9,
    pitchScore: 0,
    rollDegrees: 0,
    yawScore: 0,
    registrationAnchors: {
      screenLeftEye: { x: 0.35, y: 0.4 },
      screenRightEye: { x: 0.65, y: 0.4 },
      noseTip: { x: 0.5, y: 0.5 },
    },
  },
})

function model() {
  const value = buildComparisonRenderModel({
    angle: "front",
    manualReferences: {},
    pair: { before: pair("before"), after: pair("after") },
    residual: EMPTY_COMPARISON_ADJUSTMENT,
    revision: 1,
  })
  if (value.kind !== "ready") throw new TypeError("Expected ready comparison")
  return value
}

function controller(enabled: boolean): ComparisonEyePrivacyController {
  return {
    enabled,
    revision: 1,
    identity: `${enabled}`,
    masks: { before: detected, after: null },
    complete: false,
    canExport: !enabled,
    editingSide: null,
    draft: { left: 0.2, top: 0.3, right: 0.8, bottom: 0.5 },
    setDraft: vi.fn(),
    setEnabled: vi.fn(() => true),
    beginEdit: vi.fn(() => true),
    applyDraft: vi.fn(() => true),
    cancelEdit: vi.fn(),
    reset: vi.fn(),
    rasterFor: vi.fn(() => ({ enabled: false as const })),
  }
}

describe("comparison eye privacy controls", () => {
  it("stays opt-in and exposes the anonymity warning without opening an editor", () => {
    const privacy = controller(false)
    render(<ComparisonEyePrivacyControl active busy={false} controller={privacy} model={model()} />)
    expect(screen.getByText("익명화를 보장하지 않으니 범위를 확인해 주세요.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "범위 지정" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "눈 모자이크 켜기" }))
    expect(privacy.setEnabled).toHaveBeenCalledWith(true)
  })

  it("labels detected and missing sides and offers keyboard-reachable review actions", () => {
    const privacy = controller(true)
    render(<ComparisonEyePrivacyControl active busy={false} controller={privacy} model={model()} />)
    expect(
      screen.getByText((_value, element) => element?.textContent === "시술 전 · 자동 감지 범위"),
    ).toBeTruthy()
    expect(
      screen.getByText((_value, element) => element?.textContent === "시술 후 · 범위 확인 필요"),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "범위 지정" }))
    expect(privacy.beginEdit).toHaveBeenCalledWith("after")
  })

  it("moves and resizes the source rectangle from the keyboard without committing it", () => {
    const onChange = vi.fn()
    const renderModel = model()
    render(
      <ComparisonEyeMaskEditor
        active
        busy={false}
        draft={{ left: 0.2, top: 0.3, right: 0.8, bottom: 0.5 }}
        onApply={() => true}
        onCancel={vi.fn()}
        onChange={onChange}
        side="before"
        slot={renderModel.before.slot}
      />,
    )
    const editor = screen.getByRole("img", { name: "시술 전 원본 눈 모자이크 범위 편집" })
    fireEvent.keyDown(editor, { key: "ArrowRight" })
    expect(onChange).toHaveBeenLastCalledWith({ left: 0.202, top: 0.3, right: 0.802, bottom: 0.5 })
    fireEvent.keyDown(editor, { key: "ArrowDown", shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith({ left: 0.2, top: 0.299, right: 0.8, bottom: 0.501 })
  })
})
