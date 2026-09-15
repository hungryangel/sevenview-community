// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { InspectorSurface } from "../src/product/inspector-surface"

afterEach(() => {
  cleanup()
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280, writable: true })
})

it("does not reserve a navigation row when no review targets remain", () => {
  render(
    <InspectorSurface onClose={() => undefined} onNext={null} onPrevious={null}>
      <button type="button">보정 제어</button>
    </InspectorSurface>,
  )
  expect(screen.queryByRole("button", { name: "이전 검토" })).toBeNull()
  expect(screen.queryByRole("button", { name: "다음 검토" })).toBeNull()
})

it("inerts shared shell actions and restores the prior gallery state when the sheet closes", () => {
  // Given: the gallery already belongs to an open editor and the shared header is active.
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 768 })
  const { unmount } = render(
    <div className="app-shell">
      <header>
        <button type="button">공통 작업</button>
      </header>
      <div>
        <main className="workspace-shell">
          <section inert aria-label="사진 검토">
            갤러리
          </section>
          <InspectorSurface onClose={() => undefined} onNext={null} onPrevious={null}>
            <button type="button">보정 제어</button>
          </InspectorSurface>
        </main>
      </div>
    </div>,
  )
  const header = screen.getByRole("button", { name: "공통 작업", hidden: true }).parentElement
  const gallery = screen.getByText("갤러리")
  expect(header?.inert).toBe(true)
  // When: the sheet unmounts.
  unmount()
  // Then: external controls recover, preserving the gallery's prior inert state.
  expect(header?.inert).toBe(false)
  expect(gallery.hasAttribute("inert")).toBe(true)
})

it("lets the workspace make its gallery interactive in the same render that closes the sheet", () => {
  // Given: the workspace owns the gallery's inert attribute while editing.
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 768 })
  const shell = (open: boolean) => (
    <main className="workspace-shell">
      <section inert={open || undefined} aria-label="사진 검토">
        갤러리
      </section>
      {open ? (
        <InspectorSurface onClose={() => undefined} onNext={null} onPrevious={null}>
          <button type="button">보정 제어</button>
        </InspectorSurface>
      ) : null}
    </main>
  )
  const { rerender } = render(shell(true))
  const gallery = screen.getByText("갤러리")
  // When: the workspace closes the sheet and removes its own inert attribute.
  rerender(shell(false))
  // Then: the old sheet cannot reapply stale inert state during cleanup.
  expect(Boolean(gallery.inert) || gallery.hasAttribute("inert")).toBe(false)
})

it("focuses its heading and dismisses through Escape", () => {
  const onClose = vi.fn()
  render(
    <InspectorSurface onClose={onClose} onNext={null} onPrevious={null}>
      <button type="button">보정 제어</button>
    </InspectorSurface>,
  )

  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "세부 조정" }))
  fireEvent.keyDown(document, { key: "Escape" })
  expect(onClose).toHaveBeenCalledTimes(1)
})

it("makes the background inert and contains forward and reverse Tab focus", () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 768 })
  const onClose = vi.fn()
  render(
    <main className="workspace-shell">
      <button type="button">배경 작업</button>
      <InspectorSurface onClose={onClose} onNext={() => undefined} onPrevious={null}>
        <button type="button">보정 제어</button>
      </InspectorSurface>
    </main>,
  )

  const background = screen.getByRole("button", { name: "배경 작업", hidden: true })
  expect(background.inert).toBe(true)
  const surface = screen.getByRole("dialog", { name: "세부 조정" })
  const heading = screen.getByRole("heading", { name: "세부 조정" })
  const scrim = document.querySelector<HTMLElement>(".inspector-surface__scrim")
  expect(scrim?.tabIndex).toBe(-1)
  const firstControl = within(surface).getByRole("button", { name: "세부 조정 닫기" })
  firstControl.focus()
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
  expect(document.activeElement).toBe(heading)
  const last = screen.getByRole("button", { name: "보정 제어" })
  last.focus()
  fireEvent.keyDown(document, { key: "Tab" })
  expect(document.activeElement).toBe(heading)
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
  expect(document.activeElement).toBe(last)
})

it("leaves Escape to a topmost native dialog outside the inspector", () => {
  const onClose = vi.fn()
  render(
    <>
      <InspectorSurface onClose={onClose} onNext={null} onPrevious={null}>
        <button type="button">보정 제어</button>
      </InspectorSurface>
      <dialog aria-label="가이드" open>
        <button type="button">대화상자 제어</button>
      </dialog>
    </>,
  )
  const dialogControl = screen.getByRole("button", { name: "대화상자 제어" })
  dialogControl.focus()

  const propagated = fireEvent.keyDown(dialogControl, { key: "Escape" })

  expect(propagated).toBe(true)
  expect(onClose).not.toHaveBeenCalled()
})

it("updates modal containment across live desktop and tablet resizes", () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280, writable: true })
  render(
    <main className="workspace-shell">
      <button type="button">배경 작업</button>
      <InspectorSurface onClose={() => undefined} onNext={null} onPrevious={null}>
        <button type="button">보정 제어</button>
      </InspectorSurface>
    </main>,
  )
  const surface = screen.getByRole("dialog", { name: "세부 조정" })
  const background = screen.getByRole("button", { name: "배경 작업" })
  expect(surface.getAttribute("aria-modal")).toBeNull()
  expect(Boolean(background.inert)).toBe(false)
  background.focus()
  expect(document.activeElement).toBe(background)

  window.innerWidth = 768
  fireEvent(window, new Event("resize"))
  expect(surface.getAttribute("aria-modal")).toBe("true")
  expect(background.inert).toBe(true)
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "세부 조정" }))

  window.innerWidth = 1280
  fireEvent(window, new Event("resize"))
  expect(surface.getAttribute("aria-modal")).toBeNull()
  expect(background.inert).toBe(false)
})

it("leaves Escape to a topmost role dialog outside the inspector", () => {
  const onClose = vi.fn()
  render(
    <>
      <InspectorSurface onClose={onClose} onNext={null} onPrevious={null}>
        <button type="button">보정 제어</button>
      </InspectorSurface>
      <div aria-label="크롭 프레이밍 선택" role="dialog">
        <button type="button">프레이밍 제어</button>
      </div>
    </>,
  )
  const popupControl = screen.getByRole("button", { name: "프레이밍 제어" })
  popupControl.focus()

  fireEvent.keyDown(popupControl, { key: "Escape" })

  expect(onClose).not.toHaveBeenCalled()
})

it("leaves Escape to a nested confirmation dialog inside the inspector", () => {
  const onClose = vi.fn()
  render(
    <InspectorSurface onClose={onClose} onNext={null} onPrevious={null}>
      <div aria-label="AI 정렬 반영 확인" role="dialog">
        <button type="button">보정 유지</button>
      </div>
    </InspectorSurface>,
  )
  const confirmationControl = screen.getByRole("button", { name: "보정 유지" })
  confirmationControl.focus()

  fireEvent.keyDown(confirmationControl, { key: "Escape" })

  expect(onClose).not.toHaveBeenCalled()
})

it("leaves Escape to a nested alert confirmation inside the inspector", () => {
  // Given: a focused destructive-action confirmation inside the editor.
  const onClose = vi.fn()
  render(
    <InspectorSurface onClose={onClose} onNext={null} onPrevious={null}>
      <div aria-label="전체 기본값 재설정 확인" role="alertdialog">
        <button type="button">취소</button>
      </div>
    </InspectorSurface>,
  )
  const cancel = screen.getByRole("button", { name: "취소" })
  cancel.focus()
  // When: Escape is handled by the active confirmation surface.
  fireEvent.keyDown(cancel, { key: "Escape" })
  // Then: the enclosing editor remains open.
  expect(onClose).not.toHaveBeenCalled()
})
