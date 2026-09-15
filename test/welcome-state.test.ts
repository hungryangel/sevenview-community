// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  markWelcomeSeen,
  shouldShowWelcome,
  WELCOME_VERSION_KEY,
} from "../src/product/welcome-state"

describe("versioned welcome state", () => {
  beforeEach(() => localStorage.clear())

  it("shows once for each new manifest version", () => {
    // Given: a browser that has not seen version 0.2.0.
    expect(shouldShowWelcome("0.2.0")).toBe(true)

    // When: that version is dismissed.
    markWelcomeSeen("0.2.0")

    // Then: it stays dismissed until a newer version arrives.
    expect(localStorage.getItem(WELCOME_VERSION_KEY)).toBe("0.2.0")
    expect(shouldShowWelcome("0.2.0")).toBe(false)
    expect(shouldShowWelcome("0.2.1")).toBe(true)
  })

  it("falls back to memory when persistence is blocked", () => {
    // Given: browser storage is unavailable.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })

    // When: the current release is dismissed.
    markWelcomeSeen("blocked-storage-version")

    // Then: it remains dismissed for this page session without crashing.
    expect(shouldShowWelcome("blocked-storage-version")).toBe(false)
  })
})
