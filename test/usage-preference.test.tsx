// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetUsageMemoryForTests, setUsageCollectionEnabled } from "../src/usage/usage-events"
import { UsagePreference } from "../src/usage/usage-preference"

describe("UsagePreference", () => {
  beforeEach(() => {
    localStorage.clear()
    resetUsageMemoryForTests()
  })
  afterEach(cleanup)

  it("updates when another tab changes the persisted preference", () => {
    // Given: the default-enabled preference is rendered in this tab.
    render(<UsagePreference />)
    const checkbox = screen.getByRole("checkbox", { name: "익명 사용 집계 허용" })
    expect((checkbox as HTMLInputElement).checked).toBe(true)

    // When: another tab writes the disabled value and emits the browser storage event.
    localStorage.setItem("sevenview:usage-enabled", "disabled")
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "sevenview:usage-enabled",
          newValue: "disabled",
          storageArea: localStorage,
        }),
      ),
    )

    // Then: this tab reflects the remote local preference immediately.
    expect((checkbox as HTMLInputElement).checked).toBe(false)
  })

  it("accepts a later cross-tab update after an in-session failed write", () => {
    // Given: a failed write left an in-session disabled override.
    localStorage.setItem("sevenview:usage-enabled", "enabled")
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })
    setUsageCollectionEnabled(false)
    write.mockRestore()
    render(<UsagePreference />)
    const checkbox = screen.getByRole("checkbox", { name: "익명 사용 집계 허용" })
    expect((checkbox as HTMLInputElement).checked).toBe(false)

    // When: another tab legitimately persists enabled and emits its storage event.
    localStorage.setItem("sevenview:usage-enabled", "enabled")
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "sevenview:usage-enabled",
          newValue: "enabled",
          storageArea: localStorage,
        }),
      ),
    )

    // Then: the external persisted preference supersedes the failed local override.
    expect((checkbox as HTMLInputElement).checked).toBe(true)
  })
})
