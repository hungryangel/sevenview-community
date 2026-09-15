// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { photoId, type ViewId } from "../src/domain/types"
import { VIEW_SETS } from "../src/domain/view-set"
import type { WorkspacePhoto } from "../src/domain/workspace"
import { ProtocolToolbar } from "../src/product/protocol-toolbar"

// jsdom에는 캔버스 구현이 없다 — 미리보기는 그리지 않고 존재만 확인한다.
const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

afterEach(() => {
  cleanup()
  getContext.mockClear()
})

const photo = (
  id: string,
  view: ViewId,
  yawScore: number,
  pitchScore: number,
): WorkspacePhoto<CanvasImageSource> => ({
  adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
  assignmentMethod: "auto",
  image: document.createElement("canvas"),
  pose: {
    anchor: { x: 0.5, y: 0.5 },
    bounds: { bottom: 0.9, left: 0.2, right: 0.8, top: 0.1 },
    confidence: 0.9,
    id: photoId(id),
    pitchScore,
    rollDegrees: 0,
    yawScore,
  },
  sourceSize: { height: 1000, width: 800 },
  view,
})

// 2026-09-01 합성 7종 실측값(recovery.test.ts와 같은 각도).
const sevenPhotos: readonly WorkspacePhoto<CanvasImageSource>[] = [
  photo("front", "front", 0, 0.38),
  photo("right-oblique", "rightOblique", 0.436, 0.36),
  photo("left-oblique", "leftOblique", -0.436, 0.367),
  photo("right-profile", "rightProfile", 1.027, 0.358),
  photo("left-profile", "leftProfile", -0.952, 0.373),
  photo("chin", "chinUp", 0, 0.047),
  photo("crown", "crownDown", 0.02, 0.648),
]

type Overrides = Partial<Parameters<typeof ProtocolToolbar>[0]>

function renderToolbar(overrides: Overrides = {}) {
  return render(
    <ProtocolToolbar
      framing={FRAMING_PRESETS.clinicalStandard}
      onChangeFramingPreset={() => undefined}
      onChangeViewSet={() => undefined}
      photos={sevenPhotos}
      previewPhoto={sevenPhotos[0] ?? null}
      spares={[]}
      viewSet={VIEW_SETS.standardSeven}
      {...overrides}
    />,
  )
}

describe("ProtocolToolbar", () => {
  it("shows the current view set and framing as chips on the review screen", () => {
    // 2026-09-03 bee 지적: 프리셋·크롭은 설정이 아니라 사용 화면에서 바로 정한다.
    renderToolbar()

    const viewSetChip = screen.getByRole("button", { name: /^뷰 세트/ })
    const framingChip = screen.getByRole("button", { name: /^프레이밍/ })
    expect(viewSetChip.textContent).toContain("표준 7뷰")
    expect(framingChip.textContent).toContain("임상 표준")
    expect(viewSetChip.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("opens the view-set cards in place, previews the switch, and applies it", () => {
    const onChangeViewSet = vi.fn()
    renderToolbar({ onChangeViewSet })

    fireEvent.click(screen.getByRole("button", { name: /^뷰 세트/ }))
    expect(screen.getByRole("dialog", { name: "뷰 세트 선택" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /^뷰 세트/ }).getAttribute("aria-expanded")).toBe(
      "true",
    )
    // 열리면 선택된 카드에 포커스가 간다(화살표 키가 바로 먹는다).
    const standard = screen.getByRole("radio", { name: "성형외과 표준 7뷰 (초안)" })
    expect(document.activeElement).toBe(standard)
    expect(
      screen.getByText("바꾸면 5장 배치 · 1개 뷰 미촬영 (정면 스마일) · 예비 2장"),
    ).toBeTruthy()
    expect(screen.getByText("지금 7장 배치")).toBeTruthy()

    fireEvent.click(screen.getByRole("radio", { name: "치과·구강외과 6뷰 (초안)" }))
    expect(onChangeViewSet).toHaveBeenCalledWith("dentalSix")
  })

  it("closes with Escape and returns focus to the chip", () => {
    renderToolbar()
    const chip = screen.getByRole("button", { name: /^프레이밍/ })

    fireEvent.click(chip)
    expect(screen.getByRole("dialog", { name: "크롭 프레이밍 선택" })).toBeTruthy()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(chip)
  })

  it("renders one live crop preview per framing preset and applies the chosen preset", () => {
    const onChangeFramingPreset = vi.fn()
    renderToolbar({ onChangeFramingPreset })

    fireEvent.click(screen.getByRole("button", { name: /^프레이밍/ }))
    expect(screen.getAllByRole("img", { name: "정면 표준 크롭 미리보기" })).toHaveLength(2)
    expect(screen.getByText(/미리보기 기준: 정면 사진/)).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "클로즈업 (얼굴 확대)" }))
    expect(onChangeFramingPreset).toHaveBeenCalledWith("closeUp")
    // 이미 선택된 카드를 다시 눌러도 재적용하지 않는다.
    fireEvent.click(screen.getByRole("radio", { name: "임상 표준 (정수리~쇄골)" }))
    expect(onChangeFramingPreset).toHaveBeenCalledTimes(1)
  })

  it("reports the honest empty state when no photos are loaded", () => {
    renderToolbar({ photos: [], previewPhoto: null })

    fireEvent.click(screen.getByRole("button", { name: /^뷰 세트/ }))
    expect(screen.getAllByText("사진 없음 · 다음 정렬부터 이 구성으로 배치합니다")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: /^프레이밍/ }))
    expect(screen.getByRole("dialog", { name: "크롭 프레이밍 선택" })).toBeTruthy()
    expect(screen.getAllByText("사진을 정렬하면 여기서 크롭을 미리 봅니다")).toHaveLength(2)
  })
})
