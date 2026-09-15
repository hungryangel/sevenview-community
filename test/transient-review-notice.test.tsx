// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TransientReviewNotice } from "../src/product/transient-review-notice"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("TransientReviewNotice", () => {
  it("finishes a cancelled exit after the bounded fallback and dismisses only once", () => {
    // Given: dismissal starts but the browser cancels its opacity transition.
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(
      <TransientReviewNotice kind="warning" onDismiss={onDismiss} title="검토 필요">
        방향 확인
      </TransientReviewNotice>,
    )
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))
    const transition = screen.getByRole("status").parentElement
    if (transition === null) throw new TypeError("Missing notice transition container")
    act(() => vi.advanceTimersByTime(299))
    expect(onDismiss).not.toHaveBeenCalled()
    // When: the exit deadline expires without transitionend.
    act(() => vi.advanceTimersByTime(1))
    // Then: dismissal completes once, even if a late transition event arrives.
    expect(onDismiss).toHaveBeenCalledTimes(1)
    fireEvent.transitionEnd(transition, { propertyName: "opacity" })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("does not dismiss twice when the transition ends before the fallback", () => {
    // Given: a normally completing exit animation.
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(
      <TransientReviewNotice kind="warning" onDismiss={onDismiss} title="검토 필요">
        방향 확인
      </TransientReviewNotice>,
    )
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))
    const transition = screen.getByRole("status").parentElement
    if (transition === null) throw new TypeError("Missing notice transition container")
    fireEvent.transitionEnd(transition, { propertyName: "opacity" })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    // When: the fallback deadline later expires.
    act(() => vi.advanceTimersByTime(300))
    // Then: the already-completed dismissal is not repeated.
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("keeps the automatic-result success notice for six seconds before its fade", () => {
    // Given: a transient success confirmation after a local review action.
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(
      <TransientReviewNotice
        autoDismissMs={6_000}
        kind="success"
        onDismiss={onDismiss}
        title="7개 뷰를 제안했습니다"
      >
        자동 결과입니다. 내보내기 전에 방향과 크롭을 확인하세요
      </TransientReviewNotice>,
    )

    // When: its bounded display time elapses.
    act(() => vi.advanceTimersByTime(5_999))
    expect(screen.getByRole("status").parentElement?.className).not.toContain(
      "transient-review-notice--leaving",
    )
    act(() => vi.advanceTimersByTime(1))
    const notice = screen.getByRole("status")
    const container = notice.parentElement

    // Then: it starts a visual dismissal before its owner removes it.
    expect(container?.className).toContain("transient-review-notice--leaving")
    expect(onDismiss).not.toHaveBeenCalled()
    if (container !== null) {
      fireEvent.transitionEnd(container, { propertyName: "opacity" })
    }
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("lets a reviewer dismiss a persistent warning through the same fade", () => {
    // Given: a review warning that must remain until the reviewer acknowledges it.
    const onDismiss = vi.fn()
    render(
      <TransientReviewNotice kind="warning" onDismiss={onDismiss} title="자동 결과입니다">
        방향과 크롭을 직접 확인하세요.
      </TransientReviewNotice>,
    )

    // When: the reviewer uses the explicit close control.
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))
    const notice = screen.getByRole("status")
    const container = notice.parentElement

    // Then: the warning leaves the layout only after its fade completes.
    expect(container?.className).toContain("transient-review-notice--leaving")
    if (container !== null) {
      fireEvent.transitionEnd(container, { propertyName: "opacity" })
    }
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("removes a notice immediately when the reviewer prefers reduced motion", () => {
    // Given: a reviewer who has opted out of visual motion.
    vi.stubGlobal("matchMedia", () => ({ matches: true }))
    const onDismiss = vi.fn()
    render(
      <TransientReviewNotice kind="warning" onDismiss={onDismiss} title="자동 결과입니다">
        방향과 크롭을 직접 확인하세요.
      </TransientReviewNotice>,
    )

    // When: the reviewer dismisses the warning.
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))

    // Then: no exit animation is required before its owner is notified.
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status").parentElement?.className).not.toContain(
      "transient-review-notice--leaving",
    )
  })
})
