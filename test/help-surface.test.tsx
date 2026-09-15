// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HelpSurface, KAKAO_CHAT_URL } from "../src/product/help-surface"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Overrides = Partial<Parameters<typeof HelpSurface>[0]>

function renderOpenSurface(overrides: Overrides = {}) {
  return render(
    <HelpSurface
      exportCount={3}
      guideColor="magenta"
      guideWidth="regular"
      onChangeGuideColor={() => undefined}
      onChangeGuideWidth={() => undefined}
      onClose={() => undefined}
      open
      reviewCount={2}
      sessionStartedAt={Date.now() - 12 * 60_000}
      {...overrides}
    />,
  )
}

describe("HelpSurface", () => {
  it("opens as a native modal dialog and closes from the header control", () => {
    const onClose = vi.fn()
    renderOpenSurface({ exportCount: 0, onClose, reviewCount: 0 })

    expect(screen.getByRole("dialog", { name: "설정 · 정보" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("renders nothing while closed", () => {
    const { container } = renderOpenSurface({ open: false })
    expect(container.textContent).toBe("")
  })

  it("lets the reviewer pick the guide-line color and explains it never reaches the export", () => {
    // 2026-09-03 bee 제안: 기준선 색을 팔레트에서 고른다(기본 마젠타 — 시안 UI·피부톤과 구분).
    const onChangeGuideColor = vi.fn()
    renderOpenSurface({ onChangeGuideColor })

    const magenta = screen.getByRole("radio", { name: "기준선 색 마젠타" })
    const cyan = screen.getByRole("radio", { name: "기준선 색 시안" })
    expect((magenta as HTMLInputElement).checked).toBe(true)
    expect(screen.getAllByRole("radio", { name: /기준선 색/ })).toHaveLength(5)
    fireEvent.click(cyan)
    expect(onChangeGuideColor).toHaveBeenCalledWith("cyan")
    expect(
      screen.getByText((text) => text.includes("내보내는 이미지에는 그려지지 않습니다")),
    ).toBeTruthy()
  })

  it("points to the toolbar and the guide button instead of hosting them", () => {
    // 뷰 세트·프레이밍은 검토 화면 도구막대, 촬영 가이드는 상단 '가이드' 버튼(2026-09-03).
    renderOpenSurface()

    expect(
      screen.getByText(
        (text) => text.includes("'뷰 세트'·'프레이밍' 버튼에서") && text.includes("'가이드'"),
      ),
    ).toBeTruthy()
    expect(screen.queryByText("촬영 순서")).toBeNull()
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.getByText(/SevenView v/)).toBeTruthy()
  })

  it("lists the roadmap verbatim and points feedback to the single 신고·기능 문의 channel", () => {
    renderOpenSurface()

    expect(screen.getByText("병원 연동판에서 준비하고 있어요.")).toBeTruthy()
    for (const item of [
      "SD카드를 꽂으면 자동으로 가져오기",
      "작업 저장하고 다시 열기",
      "병원별 촬영 프리셋",
      "RAW 파일 직접 지원",
      "차트 프로그램 연동",
    ]) {
      expect(screen.getByText(item)).toBeTruthy()
    }
    // 연락 창구는 푸터 '연락하기' 하나로 단일화(2026-09-01) — 도움말 안 중복 제거.
    expect(
      screen.getByText("먼저 필요한 기능이 있으면 푸터의 '신고 · 기능 문의'로 알려주세요."),
    ).toBeTruthy()
    expect(screen.queryByRole("link", { name: "카카오톡으로 알려주기" })).toBeNull()
    expect(KAKAO_CHAT_URL).toContain("pf.kakao.com")
  })

  it("copies a session summary without photos, filenames, or patient details", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    renderOpenSurface()

    fireEvent.click(screen.getByRole("button", { name: "이번 세션 요약 복사" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    const copied = writeText.mock.calls[0]?.[0] as string
    expect(copied).toContain("내보내기 3세트")
    expect(copied).toContain("검토 경고 2건")
    expect(copied).toContain("경과 12분")
    expect(copied).not.toMatch(/\.jpg|\.png/i)
    expect(
      screen.getByText("복사했습니다. 푸터의 '신고 · 기능 문의'에 붙여넣어 보내주세요."),
    ).toBeTruthy()
  })

  it("offers aggregate-usage privacy controls in app settings", () => {
    // Given: app settings are open.
    renderOpenSurface()

    // When: the user disables aggregate usage collection.
    const preference = screen.getByRole("checkbox", { name: "익명 사용 집계 허용" })
    fireEvent.click(preference)

    // Then: the setting reports the disabled state without affecting dialog dismissal.
    expect((preference as HTMLInputElement).checked).toBe(false)
    expect(screen.getByRole("dialog", { name: "설정 · 정보" })).toBeTruthy()
  })
})
