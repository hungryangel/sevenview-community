// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { inverseCropPolygon } from "../src/domain/crop-context-geometry"
import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { photoId } from "../src/domain/types"
import type { WorkspacePhoto } from "../src/domain/workspace"
import { CropPreview, LOUPE_SIZE_PX, loupePosition } from "../src/product/crop-preview"

// jsdom에는 캔버스 구현이 없다 — 그리기는 건너뛰고 구조만 확인한다.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

afterEach(() => {
  cleanup()
})

const photo: WorkspacePhoto<CanvasImageSource> = {
  adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
  assignmentMethod: "auto",
  image: document.createElement("canvas"),
  pose: {
    anchor: { x: 0.5, y: 0.5 },
    bounds: { bottom: 0.85, left: 0.25, right: 0.75, top: 0.15 },
    confidence: 0.9,
    id: photoId("front"),
    pitchScore: 0.38,
    rollDegrees: 0,
    yawScore: 0,
  },
  sourceSize: { height: 1000, width: 800 },
  view: "front",
}

function mockCanvasRect() {
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: 300,
    height: 250,
    left: 100,
    right: 300,
    toJSON: () => ({}),
    top: 50,
    width: 200,
    x: 100,
    y: 50,
  })
}

describe("CropPreview", () => {
  it("hides crop context without changing the output canvas when the crop guide is off", () => {
    // Given: an editor whose transform and output viewport are already selected.
    const { container, rerender } = render(
      <CropPreview editing framing={FRAMING_PRESETS.clinicalStandard} photo={photo} />,
    )
    const canvas = screen.getByRole("img", { name: "정면 표준 크롭 미리보기" })
    // When: the operator hides the crop-area guide.
    rerender(
      <CropPreview
        editing
        framing={FRAMING_PRESETS.clinicalStandard}
        photo={photo}
        showCropGuide={false}
      />,
    )
    // Then: only screen context disappears; the saved viewport remains the same element.
    expect(container.querySelector(".crop-editor-context")).toBeNull()
    expect(container.querySelector(".crop-preview__crop-guide")).toBeNull()
    expect(screen.getByRole("img", { name: "정면 표준 크롭 미리보기" })).toBe(canvas)
    expect(canvas.getAttribute("width")).toBe("400")
    expect(canvas.getAttribute("height")).toBe("500")
  })

  it("shows the exact output boundary and source context only while editing", () => {
    const { container, rerender } = render(
      <CropPreview editing framing={FRAMING_PRESETS.clinicalStandard} photo={photo} />,
    )
    expect(screen.getByText("프레임 밖은 저장 시 잘립니다")).toBeTruthy()
    expect(container.querySelector(".crop-editor-context canvas")?.getAttribute("width")).toBe(
      "448",
    )
    expect(
      container.querySelector(".crop-editor-context__boundary polygon")?.getAttribute("points"),
    ).toBe("24,24 424,24 424,524 24,524")
    expect(container.querySelector(".crop-preview")?.getAttribute("width")).toBe("400")
    expect(container.querySelector(".crop-preview-frame .crop-preview__cut-label")).toBeNull()
    rerender(<CropPreview framing={FRAMING_PRESETS.clinicalStandard} photo={photo} />)
    expect(container.querySelector(".crop-editor-context")).toBeNull()
  })

  it("inverse-projects the output corners through the crop instruction", () => {
    expect(
      inverseCropPolygon({
        rotationDegrees: 0,
        scale: 2,
        sourceAnchor: { x: 300, y: 400 },
        targetAnchor: { x: 200, y: 250 },
        targetSize: { height: 500, width: 400 },
      }),
    ).toEqual([
      { x: 200, y: 275 },
      { x: 400, y: 275 },
      { x: 400, y: 525 },
      { x: 200, y: 525 },
    ])
  })
  it("shows a 3× loupe while the pointer is over the preview and hides it on leave", () => {
    // 2026-09-03 bee: 사진 가까이 가면 그 지점이 확대돼 보인다 — 2점 수평을 정확히 찍기 위한 보조.
    mockCanvasRect()
    render(<CropPreview framing={FRAMING_PRESETS.clinicalStandard} magnifier photo={photo} />)

    const canvas = screen.getByRole("img", { name: "정면 표준 크롭 미리보기" })
    expect(screen.queryByRole("img", { name: "확대경 3배" })).toBeNull()
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 150 })
    expect(screen.getByRole("img", { name: "확대경 3배" })).toBeTruthy()
    fireEvent.pointerLeave(canvas)
    expect(screen.queryByRole("img", { name: "확대경 3배" })).toBeNull()
  })

  it("does not show a loupe on previews that did not ask for one", () => {
    mockCanvasRect()
    render(<CropPreview framing={FRAMING_PRESETS.clinicalStandard} photo={photo} />)
    fireEvent.pointerMove(screen.getByRole("img"), { clientX: 200, clientY: 150 })
    expect(screen.queryByRole("img", { name: "확대경 3배" })).toBeNull()
  })

  it("draws the two-point line only while a line is supplied", () => {
    const { container, rerender } = render(
      <CropPreview
        framing={FRAMING_PRESETS.clinicalStandard}
        line={[
          { x: 80, y: 150 },
          { x: 320, y: 250 },
        ]}
        marks={[
          { x: 80, y: 150 },
          { x: 320, y: 250 },
        ]}
        photo={photo}
      />,
    )
    const line = container.querySelector(".crop-preview__line line")
    expect(line?.getAttribute("x1")).toBe("80")
    expect(line?.getAttribute("y2")).toBe("250")
    rerender(<CropPreview framing={FRAMING_PRESETS.clinicalStandard} photo={photo} />)
    expect(container.querySelector(".crop-preview__line")).toBeNull()
  })

  it("keeps the loupe inside the viewport by flipping sides near the edges", () => {
    const viewport = { width: 1280, height: 800 }
    // 왼쪽 위 여유 있음 → 포인터 오른쪽 위.
    expect(loupePosition({ x: 300, y: 400 }, viewport)).toEqual({
      left: 324,
      top: 400 - 24 - LOUPE_SIZE_PX,
    })
    // 오른쪽 끝·위쪽 끝 → 왼쪽 아래로 넘긴다.
    expect(loupePosition({ x: 1250, y: 30 }, viewport)).toEqual({
      left: 1250 - 24 - LOUPE_SIZE_PX,
      top: 54,
    })
  })
})
