// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useRef, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SevenViewApp } from "../src/product/sevenview-app"
import type { WorkspaceStatus } from "../src/product/workspace"

afterEach(cleanup)

const mountCounts = { comparison: 0, sevenView: 0 }

function StatefulSevenView({ active, onStatusChange }: SurfaceProps) {
  const mounted = useRef(false)
  const [adjustment, setAdjustment] = useState(0)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      mountCounts.sevenView += 1
    }
    onStatusChange({ dirty: adjustment !== 0, exported: false })
  }, [adjustment, onStatusChange])
  return (
    <section>
      <h1 id="seven-view-heading" tabIndex={-1}>
        7뷰 작업
      </h1>
      <button onClick={() => setAdjustment((value) => value + 1)} type="button">
        가로 {adjustment}%
      </button>
      <span>{active ? "7뷰 활성" : "7뷰 비활성"}</span>
    </section>
  )
}

type SurfaceProps = {
  readonly active: boolean
  readonly onOpenGuide?: () => void
  readonly onStatusChange: (status: WorkspaceStatus) => void
}

function StatefulComparison({ active, onStatusChange }: SurfaceProps) {
  const mounted = useRef(false)
  const [slider, setSlider] = useState(50)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      mountCounts.comparison += 1
    }
    onStatusChange({ dirty: slider !== 50, exported: false })
  }, [onStatusChange, slider])
  return (
    <section>
      <h1 id="comparison-heading" tabIndex={-1}>
        전후 비교 작업
      </h1>
      <button onClick={() => setSlider(37)} type="button">
        슬라이더 {slider}%
      </button>
      <span>{active ? "비교 활성" : "비교 비활성"}</span>
    </section>
  )
}

function RichSevenView({ onStatusChange }: SurfaceProps) {
  useEffect(
    () =>
      onStatusChange({
        activity: { kind: "done", label: "7뷰 정렬 완료" },
        dirty: true,
        exportCount: 3,
        exported: false,
        privacyState: "modelLoading",
        reviewCount: 2,
        sessionStartedAt: Date.now() - 60_000,
      }),
    [onStatusChange],
  )
  return (
    <h1 id="seven-view-heading" tabIndex={-1}>
      7뷰 작업
    </h1>
  )
}

describe("SevenViewApp unified shell", () => {
  it("opens 7뷰 by default with one shared chrome and unique owned ids", () => {
    render(
      <SevenViewApp ComparisonSurface={StatefulComparison} SevenViewSurface={StatefulSevenView} />,
    )
    expect(screen.getByRole("tablist", { name: "작업" })).toBeTruthy()
    const clinicalTab = screen.getByRole("tab", { name: "임상 사진 정렬" })
    expect(clinicalTab.getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("tab", { name: "치료 전후 비교" })).toBeTruthy()
    expect(screen.getByRole("banner").contains(clinicalTab)).toBe(true)
    expect(screen.getAllByRole("banner")).toHaveLength(1)
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1)
    expect(screen.getAllByText("SevenView", { selector: "strong" })).toHaveLength(1)
    expect(screen.getAllByRole("link", { name: "본문으로 건너뛰기" })).toHaveLength(1)
    expect(document.querySelectorAll("#seven-view-main-content")).toHaveLength(1)
    expect(document.querySelectorAll("#comparison-main-content")).toHaveLength(1)
    expect(document.querySelectorAll("[id]").length).toBe(
      new Set([...document.querySelectorAll("[id]")].map((node) => node.id)).size,
    )
  })

  it("keeps both sessions mounted and retained without a destructive mode dialog", () => {
    mountCounts.comparison = 0
    mountCounts.sevenView = 0
    render(
      <SevenViewApp ComparisonSurface={StatefulComparison} SevenViewSurface={StatefulSevenView} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "가로 0%" }))
    fireEvent.click(screen.getByRole("tab", { name: "치료 전후 비교" }))
    fireEvent.click(screen.getByRole("button", { name: "슬라이더 50%" }))
    fireEvent.click(screen.getByRole("tab", { name: "임상 사진 정렬" }))
    expect(screen.getByRole("button", { name: "가로 1%" })).toBeTruthy()
    expect(screen.queryByText("현재 결과를 버리고 작업 유형을 변경할까요?")).toBeNull()
    expect(mountCounts).toEqual({ comparison: 1, sevenView: 1 })
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "7뷰 작업" }))
  })

  it("hides and inerts only the inactive panel and updates the skip target", () => {
    render(
      <SevenViewApp ComparisonSurface={StatefulComparison} SevenViewSurface={StatefulSevenView} />,
    )
    const sevenPanel = document.getElementById("seven-view-panel")
    const comparisonPanel = document.getElementById("comparison-panel")
    expect(sevenPanel?.hidden).toBe(false)
    expect(sevenPanel?.hasAttribute("inert")).toBe(false)
    expect(comparisonPanel?.hidden).toBe(true)
    expect(comparisonPanel?.hasAttribute("inert")).toBe(true)
    expect(screen.getByRole("link", { name: "본문으로 건너뛰기" }).getAttribute("href")).toBe(
      "#seven-view-main-content",
    )
    fireEvent.click(screen.getByRole("tab", { name: "치료 전후 비교" }))
    expect(sevenPanel?.hidden).toBe(true)
    expect(sevenPanel?.hasAttribute("inert")).toBe(true)
    expect(comparisonPanel?.hidden).toBe(false)
    expect(screen.getByRole("link", { name: "본문으로 건너뛰기" }).getAttribute("href")).toBe(
      "#comparison-main-content",
    )
  })

  it("installs one unload guard for either dirty session", () => {
    const add = vi.spyOn(window, "addEventListener")
    const remove = vi.spyOn(window, "removeEventListener")
    const view = render(
      <SevenViewApp ComparisonSurface={StatefulComparison} SevenViewSurface={StatefulSevenView} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "가로 0%" }))
    expect(add.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1)
    view.unmount()
    expect(remove.mock.calls.some(([type]) => type === "beforeunload")).toBe(true)
    add.mockRestore()
    remove.mockRestore()
  })

  it("keeps arrow-key focus in the roving tablist", () => {
    render(
      <SevenViewApp ComparisonSurface={StatefulComparison} SevenViewSurface={StatefulSevenView} />,
    )
    const sevenTab = screen.getByRole("tab", { name: "임상 사진 정렬" })
    sevenTab.focus()
    fireEvent.keyDown(sevenTab, { key: "ArrowRight" })
    const comparisonTab = screen.getByRole("tab", { name: "치료 전후 비교" })
    expect(comparisonTab.getAttribute("aria-selected")).toBe("true")
    expect(document.activeElement).toBe(comparisonTab)
  })

  it("uses authoritative activity and session counts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    render(<SevenViewApp ComparisonSurface={StatefulComparison} SevenViewSurface={RichSevenView} />)

    expect(await screen.findByText("7뷰 정렬 완료")).toBeTruthy()
    expect(document.querySelector(".privacy-status--modelLoading")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "설정 · 정보" }))
    fireEvent.click(screen.getByRole("button", { name: "이번 세션 요약 복사" }))
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("내보내기 3세트 · 검토 경고 2건"),
    )
  })
})
