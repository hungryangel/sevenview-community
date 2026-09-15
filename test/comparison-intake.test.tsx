// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { photoId } from "../src/domain/types"
import { ComparisonIntake } from "../src/product/comparison-intake"
import type { ComparisonIntakeProps } from "../src/product/comparison-intake-types"

vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

afterEach(cleanup)

const empty = { kind: "empty" } as const
const BASE_PROPS = {
  angle: "front",
  canAnalyze: false,
  canExport: false,
  exportMessage: null,
  exporting: false,
  onAnalyze: () => undefined,
  onAngleChange: () => undefined,
  onExport: () => undefined,
  onRemove: () => undefined,
  onRetry: () => undefined,
  onSelect: () => undefined,
  progress: 0,
} satisfies Omit<ComparisonIntakeProps, "before" | "after">

const ready = {
  kind: "ready" as const,
  file: new File(["face"], "face.png", { type: "image/png" }),
  decoded: { image: document.createElement("canvas"), width: 800, height: 1000 },
  pose: {
    anchor: { x: 0.5, y: 0.5 },
    bounds: { bottom: 0.8, left: 0.25, right: 0.75, top: 0.2 },
    confidence: 0.9,
    id: photoId("comparison-ready"),
    pitchScore: 0,
    rollDegrees: 0,
    yawScore: 0,
  },
}

describe("ComparisonIntake", () => {
  it("starts with photo inputs rather than requiring a shared direction", () => {
    render(<ComparisonIntake {...BASE_PROPS} before={empty} after={empty} />)
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.getByRole("button", { name: "두 사진 정렬" })).toBeTruthy()
  })

  it("keeps fixed semantic sides and requires both selected photos", () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <ComparisonIntake {...BASE_PROPS} before={empty} after={empty} onSelect={onSelect} />,
    )
    expect(screen.getByRole("heading", { name: "시술 전 사진" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "시술 후 사진" })).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "두 사진 정렬" }).disabled).toBe(
      true,
    )
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "비교 이미지 저장" }).disabled,
    ).toBe(true)

    const before = new File(["before"], "private-before.jpg", { type: "image/jpeg" })
    fireEvent.change(screen.getByLabelText("시술 전 사진 파일 선택"), {
      target: { files: [before] },
    })
    expect(onSelect).toHaveBeenCalledWith("before", before)
    expect(screen.queryByText("private-before.jpg")).toBeNull()

    rerender(
      <ComparisonIntake
        {...BASE_PROPS}
        before={{ kind: "pending", file: before, previewUrl: "blob:before" }}
        after={empty}
        onSelect={onSelect}
      />,
    )
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "두 사진 정렬" }).disabled).toBe(
      true,
    )
  })

  it("rejects unsupported input without exposing its filename", () => {
    render(<ComparisonIntake {...BASE_PROPS} before={empty} after={empty} />)
    fireEvent.change(screen.getByLabelText("시술 후 사진 파일 선택"), {
      target: { files: [new File(["raw"], "patient-secret.heic", { type: "image/heic" })] },
    })

    expect(screen.getByRole("alert").textContent).toContain("HEIC·HEIF는 지원하지 않습니다")
    expect(screen.queryByText("patient-secret.heic")).toBeNull()
  })

  it("moves focus to the result heading when both analyses become ready", () => {
    const { rerender } = render(<ComparisonIntake {...BASE_PROPS} before={empty} after={empty} />)

    rerender(
      <ComparisonIntake
        {...BASE_PROPS}
        before={ready}
        after={ready}
        canExport={true}
        progress={100}
      />,
    )

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "전후 비교", level: 1 }),
    )
    expect(screen.getAllByRole("img")).toHaveLength(2)
  })

  it("keeps the primary export action beside the comparison cautions", () => {
    const onExport = vi.fn()
    render(
      <ComparisonIntake
        {...BASE_PROPS}
        before={ready}
        after={ready}
        canExport={true}
        onExport={onExport}
        progress={100}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "비교 이미지 저장" }))
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it("asks before clearing an unsaved pair and returns focus safely on cancel or Escape", () => {
    const onReset = vi.fn()
    render(
      <ComparisonIntake
        {...BASE_PROPS}
        before={ready}
        after={ready}
        canExport
        exported={false}
        onReset={onReset}
        progress={100}
      />,
    )

    const trigger = screen.getByRole("button", { name: "새 비교 시작" })
    fireEvent.click(trigger)
    expect(screen.getByRole("alertdialog", { name: "저장하지 않은 비교 지우기" })).toBeTruthy()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: "계속 작업" }))
    expect(onReset).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    const exportButton = screen.getByRole("button", { name: "비교 이미지 저장" })
    exportButton.focus()
    fireEvent.pointerDown(exportButton)
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(document.activeElement).toBe(exportButton)

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: "저장하지 않고 새 비교 시작" }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it("clears a saved pair directly and focuses the empty before slot", () => {
    const onReset = vi.fn()
    const { rerender } = render(
      <ComparisonIntake
        {...BASE_PROPS}
        before={ready}
        after={ready}
        canExport
        exported
        onReset={onReset}
        progress={100}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "새 비교 시작" }))
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("alertdialog")).toBeNull()

    rerender(
      <ComparisonIntake
        {...BASE_PROPS}
        before={empty}
        after={empty}
        exported={false}
        onReset={onReset}
      />,
    )
    expect(document.activeElement).toBe(screen.getAllByRole("button", { name: "사진 선택" })[0])
  })

  it("locks reset, replacement, angle, and reference changes while exporting", () => {
    render(
      <ComparisonIntake
        {...BASE_PROPS}
        before={ready}
        after={ready}
        exported={false}
        exporting
        angleResolution={{
          kind: "ready",
          angle: "front",
          before: "front",
          after: "front",
          provenance: "automatic",
        }}
        onReset={() => undefined}
        progress={100}
      />,
    )

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "새 비교 시작" }).disabled).toBe(
      true,
    )
    expect(screen.getByLabelText<HTMLSelectElement>("촬영 방향 직접 확인").disabled).toBe(true)
    for (const input of screen.getAllByLabelText(/사진 파일 선택/)) {
      expect((input as HTMLInputElement).disabled).toBe(true)
    }
    for (const button of screen.getAllByRole<HTMLButtonElement>("button", {
      name: /사진 교체|제거/,
    })) {
      expect(button.disabled).toBe(true)
    }
  })
})
