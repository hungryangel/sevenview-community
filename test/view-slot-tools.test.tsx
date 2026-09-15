// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ViewSlot } from "../src/ui/view-slot"

afterEach(() => {
  cleanup()
})

describe("ViewSlot tools slot", () => {
  it("renders corner tools as siblings of the tile button so nested buttons never happen", () => {
    // 2026-09-03 bee: 타일 안 돋보기 버튼 — 그 칸에서만 확대경을 켠다.
    const onSelect = vi.fn()
    const onToggle = vi.fn()
    render(
      <ViewSlot
        index={1}
        label="정면"
        onSelect={onSelect}
        state="ready"
        tools={
          <button
            aria-label="정면 확대경 켜기"
            aria-pressed={false}
            onClick={onToggle}
            type="button"
          >
            🔍
          </button>
        }
        variant="contactSheet"
      />,
    )

    const tool = screen.getByRole("button", { name: "정면 확대경 켜기" })
    expect(tool.closest("button.view-slot")).toBeNull()
    fireEvent.click(tool)
    expect(onToggle).toHaveBeenCalledTimes(1)
    // 도구 클릭은 타일 선택을 건드리지 않는다(형제 요소라 버블링도 없다).
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("renders no tools container when none are given", () => {
    const { container } = render(<ViewSlot index={2} label="우측 45도" state="empty" />)
    expect(container.querySelector(".view-slot__tools")).toBeNull()
  })
})
