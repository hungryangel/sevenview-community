// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { photoId } from "../src/domain/types"
import {
  buildComparisonRenderModel,
  EMPTY_COMPARISON_ADJUSTMENT,
} from "../src/product/comparison-render-model"
import { ComparisonViewer } from "../src/product/comparison-viewer"

vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

afterEach(cleanup)

const image = document.createElement("canvas")
const pair = {
  before: {
    kind: "ready" as const,
    file: new File(["before"], "before.png", { type: "image/png" }),
    decoded: { image, width: 800, height: 1000 },
    pose: {
      anchor: { x: 0.4, y: 0.45 },
      bounds: { bottom: 0.75, left: 0.25, right: 0.75, top: 0.25 },
      confidence: 0.9,
      id: photoId("before"),
      pitchScore: 0,
      rollDegrees: -2,
      yawScore: 0,
      registrationAnchors: {
        screenLeftEye: { x: 0.35, y: 0.4 },
        screenRightEye: { x: 0.65, y: 0.4 },
        noseTip: { x: 0.5, y: 0.5 },
      },
    },
  },
  after: {
    kind: "ready" as const,
    file: new File(["after"], "after.png", { type: "image/png" }),
    decoded: { image, width: 800, height: 1000 },
    pose: {
      anchor: { x: 0.5, y: 0.45 },
      bounds: { bottom: 0.7, left: 0.3, right: 0.7, top: 0.3 },
      confidence: 0.9,
      id: photoId("after"),
      pitchScore: 0,
      rollDegrees: 1,
      yawScore: 0,
      registrationAnchors: {
        screenLeftEye: { x: 0.36, y: 0.4 },
        screenRightEye: { x: 0.64, y: 0.4 },
        noseTip: { x: 0.5, y: 0.5 },
      },
    },
  },
}

function modelFor(value = pair, panX = 0) {
  const model = buildComparisonRenderModel({
    angle: "front",
    manualReferences: {},
    pair: value,
    residual: { ...EMPTY_COMPARISON_ADJUSTMENT, panX },
    revision: 1,
  })
  if (model.kind !== "ready") throw new Error("fixture registration must be ready")
  return model
}

describe("ComparisonViewer", () => {
  it("reverses presentation without changing before/after image identity", () => {
    const onOrderChange = vi.fn()
    const model = modelFor()
    const { rerender } = render(
      <ComparisonViewer model={model} order="beforeAfter" onOrderChange={onOrderChange} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "표시 순서 바꾸기" }))
    expect(onOrderChange).toHaveBeenCalledWith("afterBefore")
    rerender(<ComparisonViewer model={model} order="afterBefore" onOrderChange={onOrderChange} />)
    expect(
      [...document.querySelectorAll("figcaption")].map((caption) => caption.textContent),
    ).toEqual(["시술 후", "시술 전"])
    fireEvent.click(screen.getByRole("button", { name: "슬라이더" }))
    expect(
      document.querySelector<HTMLElement>(".comparison-viewer__wipe-after")?.style.clipPath,
    ).toBe("inset(0 50% 0 0)")
    expect(screen.getByText("왼쪽 · 시술 후")).toBeTruthy()
    expect(screen.getByText("오른쪽 · 시술 전")).toBeTruthy()
  })
  it("keeps the before photo left of the wipe boundary and after on the right", () => {
    render(<ComparisonViewer model={modelFor()} />)
    fireEvent.click(screen.getByRole("button", { name: "슬라이더" }))
    const afterLayer = document.querySelector<HTMLElement>(".comparison-viewer__wipe-after")
    expect(afterLayer?.style.clipPath).toBe("inset(0 0 0 50%)")
    expect(screen.getByText("왼쪽 · 시술 전")).toBeTruthy()
    expect(screen.getByText("오른쪽 · 시술 후")).toBeTruthy()
  })

  it("switches among equal-frame, wipe, and manual viewing modes", () => {
    render(<ComparisonViewer model={modelFor()} />)

    expect(screen.getAllByRole("img")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "슬라이더" }))
    const wipe = screen.getByRole("slider", { name: "비교 경계 위치" })
    expect(wipe.getAttribute("aria-valuetext")).toBe("왼쪽에서 50% · 왼쪽 시술 전 · 오른쪽 시술 후")
    fireEvent.keyDown(wipe, { key: "ArrowRight" })
    expect(screen.getByRole<HTMLInputElement>("slider", { name: "비교 경계 위치" }).value).toBe(
      "51",
    )
    expect(
      document.querySelector<HTMLElement>(".comparison-viewer__wipe-after")?.style.clipPath,
    ).toBe("inset(0 0 0 51%)")

    fireEvent.click(screen.getByRole("button", { name: "전후 전환" }))
    expect(screen.getByText("현재 시술 전 사진")).toBeTruthy()
    fireEvent.keyDown(screen.getByRole("button", { name: "시술 후 사진 보기" }), {
      key: " ",
    })
    fireEvent.click(screen.getByRole("button", { name: "시술 후 사진 보기" }))
    expect(screen.getByText("현재 시술 후 사진")).toBeTruthy()
  })

  it("keeps photo information off until the user chooses real registration or face geometry", () => {
    const model = modelFor()
    const { rerender } = render(<ComparisonViewer model={model} />)

    const disclosure = screen.getByText("사진 위 정보")
    expect(disclosure.tagName).toBe("SUMMARY")
    expect(screen.queryByRole("button", { name: "표시 안 함" })).toBeNull()
    fireEvent.click(disclosure)
    fireEvent(disclosure.parentElement as HTMLElement, new Event("toggle"))
    expect(screen.getByRole("button", { name: "표시 안 함" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    expect(document.querySelector(".comparison-photo-overlay")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "정렬 기준점" }))
    expect(document.querySelectorAll(".comparison-photo-overlay")).toHaveLength(2)
    expect(screen.getByText(/시술 전 · 정렬 기준점 · 자동 감지/)).toBeTruthy()
    expect(screen.getAllByText(/1 화면 왼쪽 눈 · 2 화면 오른쪽 눈/)).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "얼굴 영역" }))
    expect(document.querySelectorAll(".comparison-photo-overlay__face-region")).toHaveLength(2)
    expect(screen.getByText(/시술 후 · 얼굴 영역 · 원본 분석 위치/)).toBeTruthy()
    expect(screen.queryByText(/효과|주름|피부|진단/)).toBeNull()

    if (model.after.slot.kind !== "ready") throw new Error("fixture must have detected pose")
    rerender(
      <ComparisonViewer
        model={{
          ...model,
          after: {
            ...model.after,
            slot: {
              ...model.after.slot,
              pose: {
                ...model.after.slot.pose,
                bounds: { bottom: 0.7, left: 2, right: 3, top: 0.3 },
              },
            },
          },
        }}
      />,
    )
    expect(screen.getByText("시술 후 · 얼굴 영역 · 표시할 실제 위치 정보 없음")).toBeTruthy()
    expect(document.querySelectorAll(".comparison-photo-overlay__face-region")).toHaveLength(1)
  })
})
