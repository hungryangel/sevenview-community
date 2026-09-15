// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { photoId } from "../src/domain/types"
import { ComparisonPairedReferenceEditor } from "../src/product/comparison-paired-reference-editor"

const image = document.createElement("canvas")
const ready = (side: "before" | "after") => ({
  kind: "ready" as const,
  file: new File([side], `${side}.png`, { type: "image/png" }),
  decoded: { image, width: 800, height: 1000 },
  pose: {
    anchor: { x: 0.5, y: 0.45 },
    bounds: { bottom: 0.75, left: 0.25, right: 0.75, top: 0.25 },
    confidence: 0.9,
    id: photoId(side),
    pitchScore: 0,
    rollDegrees: 0,
    yawScore: 0,
    registrationAnchors: {
      screenLeftEye: { x: side === "before" ? 0.35 : 0.36, y: 0.4 },
      screenRightEye: { x: side === "before" ? 0.65 : 0.64, y: 0.4 },
      noseTip: { x: 0.5, y: 0.5 },
    },
  },
})
const pair = { before: ready("before"), after: ready("after") }

beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ComparisonPairedReferenceEditor", () => {
  it("accepts detected counterparts deliberately and applies both references once", () => {
    const onApply = vi.fn()
    const onCancel = vi.fn()
    render(
      <ComparisonPairedReferenceEditor
        active
        angle="front"
        disabled={false}
        onApply={onApply}
        onCancel={onCancel}
        pair={pair}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "시술 전 모델 제안 수락" }))
    fireEvent.click(screen.getByRole("button", { name: "시술 후 모델 제안 수락" }))
    expect(screen.getByText(/같은 부위인지 확인/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "같은 부위 확인" }))
    fireEvent.click(screen.getByRole("button", { name: "시술 전 모델 제안 수락" }))
    fireEvent.click(screen.getByRole("button", { name: "시술 후 모델 제안 수락" }))
    fireEvent.click(screen.getByRole("button", { name: "같은 부위 확인" }))
    expect(screen.getByRole("region", { name: "정렬 미리보기" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "정렬 적용" }))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith({
      before: { first: { x: 0.35, y: 0.4 }, second: { x: 0.65, y: 0.4 } },
      after: { first: { x: 0.36, y: 0.4 }, second: { x: 0.64, y: 0.4 } },
    })
    fireEvent.click(screen.getByRole("button", { name: "취소" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("does not place a point after a cancelled touch press", () => {
    render(
      <ComparisonPairedReferenceEditor
        active
        angle="front"
        disabled={false}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        pair={pair}
      />,
    )
    const source = screen.getByRole("img", { name: "시술 전 원본" })
    vi.spyOn(source, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 200, 250))
    fireEvent.pointerDown(source, {
      clientX: 100,
      clientY: 100,
      pointerId: 7,
      pointerType: "touch",
    })
    fireEvent.pointerCancel(source, { pointerId: 7, pointerType: "touch" })
    fireEvent.pointerUp(source, { clientX: 100, clientY: 100, pointerId: 7, pointerType: "touch" })
    expect(screen.getByText("시술 전 원본에서 기준점 ①을 선택하세요.")).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "정렬 적용" }).disabled).toBe(true)
  })

  it("moves the keyboard cursor without advancing until explicit commit", () => {
    render(
      <ComparisonPairedReferenceEditor
        active
        angle="front"
        disabled={false}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        pair={pair}
      />,
    )
    const source = screen.getByRole("img", { name: "시술 전 원본" })
    fireEvent.keyDown(source, { key: "ArrowRight" })
    expect(screen.getByText("시술 전 원본에서 기준점 ①을 선택하세요.")).toBeTruthy()
    fireEvent.keyDown(source, { key: "Enter" })
    expect(screen.getByText("시술 후 원본에서 기준점 ①을 선택하세요.")).toBeTruthy()
  })
})
