// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { WorkspaceReviewNotice } from "../src/product/workspace-review-notice"
import type { WorkspaceMessage } from "../src/product/workspace-types"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const warning: WorkspaceMessage = { kind: "warning", title: "검토 필요", text: "사진 방향 확인" }
const success: WorkspaceMessage = { kind: "success", title: "분석 완료", text: "사진 검토" }

function hosts() {
  const { container } = render(
    <>
      <section aria-label="갤러리" />
      <section aria-label="편집창" />
    </>,
  )
  return {
    gallery: screen.getByRole("region", { name: "갤러리" }),
    editor: screen.getByRole("region", { name: "편집창" }),
    container,
  }
}

it("preserves an in-progress dismissal when the notice moves between review hosts", () => {
  // Given: the current warning is already leaving its gallery host.
  const { gallery, editor } = hosts()
  const onDismiss = vi.fn()
  const { rerender } = render(
    <WorkspaceReviewNotice host={gallery} message={warning} onDismiss={onDismiss} />,
  )
  const notice = screen.getByRole("status")
  const transition = notice.parentElement
  if (transition === null) throw new TypeError("Missing notice transition container")
  fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))
  expect(transition.classList.contains("transient-review-notice--leaving")).toBe(true)
  // When: selection changes the display host during the fade.
  rerender(<WorkspaceReviewNotice host={editor} message={warning} onDismiss={onDismiss} />)
  // Then: the same notice finishes the same dismissal in its new host.
  expect(screen.getByRole("status")).toBe(notice)
  expect(editor.contains(notice)).toBe(true)
  expect(gallery.contains(notice)).toBe(false)
  expect(transition.classList.contains("transient-review-notice--leaving")).toBe(true)
  fireEvent.transitionEnd(transition, { propertyName: "opacity" })
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

it("keeps the original six-second deadline when a success notice moves hosts", () => {
  // Given: four seconds of the success notice lifetime have elapsed.
  vi.useFakeTimers()
  const { gallery, editor } = hosts()
  const onDismiss = vi.fn()
  const { rerender } = render(
    <WorkspaceReviewNotice host={gallery} message={success} onDismiss={onDismiss} />,
  )
  act(() => vi.advanceTimersByTime(4_000))
  // When: the same success notice moves into the editor.
  rerender(<WorkspaceReviewNotice host={editor} message={success} onDismiss={onDismiss} />)
  act(() => vi.advanceTimersByTime(2_000))
  // Then: its original deadline starts the exit instead of a fresh six-second timer.
  expect(
    screen
      .getByRole("status")
      .parentElement?.classList.contains("transient-review-notice--leaving"),
  ).toBe(true)
})

it("finishes dismissal after moving hosts even when the browser cancels transitionend", () => {
  // Given: a leaving notice is transferred into the editor without a transitionend event.
  vi.useFakeTimers()
  const { gallery, editor } = hosts()
  const onDismiss = vi.fn()
  const { rerender } = render(
    <WorkspaceReviewNotice host={gallery} message={warning} onDismiss={onDismiss} />,
  )
  fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))
  rerender(<WorkspaceReviewNotice host={editor} message={warning} onDismiss={onDismiss} />)
  // When: the bounded exit deadline expires in the new host.
  act(() => vi.advanceTimersByTime(300))
  // Then: its original dismissal is delivered exactly once.
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

it("gives a successor message a fresh dismissal state and timer", () => {
  // Given: the previous warning has started leaving.
  vi.useFakeTimers()
  const { gallery, editor } = hosts()
  const onDismiss = vi.fn()
  const { rerender } = render(
    <WorkspaceReviewNotice host={gallery} message={warning} onDismiss={onDismiss} />,
  )
  fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))
  // When: a different result message replaces it in the next host.
  rerender(<WorkspaceReviewNotice host={editor} message={success} onDismiss={onDismiss} />)
  act(() => vi.advanceTimersByTime(5_999))
  // Then: stale dismissal cannot remove the new message early.
  expect(
    screen
      .getByRole("status")
      .parentElement?.classList.contains("transient-review-notice--leaving"),
  ).toBe(false)
  expect(onDismiss).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(
    screen
      .getByRole("status")
      .parentElement?.classList.contains("transient-review-notice--leaving"),
  ).toBe(true)
})

it("detaches its owned portal container when the notice owner unmounts", () => {
  // Given: a notice mounted in a workspace host.
  const { gallery } = hosts()
  const { unmount } = render(
    <WorkspaceReviewNotice host={gallery} message={warning} onDismiss={() => undefined} />,
  )
  const ownedContainer = gallery.firstElementChild
  expect(ownedContainer).not.toBeNull()
  // When: the workspace notice owner unmounts.
  unmount()
  // Then: its DOM container is detached from the workspace host.
  expect(ownedContainer?.isConnected).toBe(false)
  expect(gallery.childElementCount).toBe(0)
})
