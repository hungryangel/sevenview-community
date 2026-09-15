// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://sevenview.velnoc.com/" }

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  isOfficialUsageLocation,
  isUsageCollectionEnabled,
  parseUsageEndpoint,
  recordUsageEvent,
  resetUsageMemoryForTests,
  setUsageCollectionEnabled,
} from "../src/usage/usage-events"

const endpoint = "https://usage.velnoc.com/events"

function requestInit(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
  const call = fetchMock.mock.calls[0]
  expect(call).toBeDefined()
  return call?.[1] as RequestInit
}

describe("aggregate usage events", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetUsageMemoryForTests()
    vi.stubEnv("VITE_USAGE_ENDPOINT", endpoint)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("accepts only strict HTTPS event endpoints and the official hostname", () => {
    // Given: candidate collector endpoints and runtime locations.
    const official = { hostname: "sevenview.velnoc.com", protocol: "https:" }

    // When: the telemetry boundary parses them.
    const parsed = parseUsageEndpoint(endpoint)

    // Then: only the exact endpoint shape and official runtime are accepted.
    expect(parsed?.href).toBe(endpoint)
    expect(parseUsageEndpoint("http://usage.velnoc.com/events")).toBeNull()
    expect(parseUsageEndpoint("https://usage.velnoc.com/events?source=app")).toBeNull()
    expect(parseUsageEndpoint("https://usage.velnoc.com/other")).toBeNull()
    expect(isOfficialUsageLocation(official)).toBe(true)
    expect(isOfficialUsageLocation({ ...official, hostname: "localhost" })).toBe(false)
  })

  it("limits landing visits to the official root route", () => {
    // Given: the official hostname is currently rendering a non-root route.
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState({}, "", "/app")

    // When: a landing visit is attempted from that route.
    recordUsageEvent("landing_visit")

    // Then: no request is emitted.
    expect(fetchMock).not.toHaveBeenCalled()
    window.history.replaceState({}, "", "/")
  })

  it("sends the exact event-only request without credentials or referrer", async () => {
    // Given: an official page and an available collector.
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    // When: the landing event is recorded.
    recordUsageEvent("landing_visit")
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Then: the request contains only the fixed event contract and privacy-safe options.
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(endpoint)
    const init = requestInit(fetchMock)
    expect(JSON.parse(String(init.body))).toEqual({ event: "landing_visit" })
    expect(init.credentials).toBe("omit")
    expect(init.referrerPolicy).toBe("no-referrer")
    expect(init.method).toBe("POST")
  })

  it("deduplicates landing and app use across rerenders and reloads but counts each export", async () => {
    // Given: a tab with working session storage.
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    // When: lifecycle events repeat and two downloads succeed.
    recordUsageEvent("landing_visit")
    recordUsageEvent("landing_visit")
    recordUsageEvent("app_use")
    recordUsageEvent("app_use")
    recordUsageEvent("export_complete")
    recordUsageEvent("export_complete")
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))

    // Then: the tab-session events are once and each export action is counted.
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).event)).toEqual([
      "landing_visit",
      "app_use",
      "export_complete",
      "export_complete",
    ])
  })

  it("does not send when locally disabled", () => {
    // Given: a collector spy.
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    // When: collection is disabled and an event is attempted.
    setUsageCollectionEnabled(false)
    recordUsageEvent("app_use")

    // Then: no network request occurs and the local setting persists.
    expect(isUsageCollectionEnabled()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(localStorage.getItem("sevenview:usage-enabled")).toBe("disabled")
  })

  it.each([
    ["DNT", { doNotTrack: "1" }],
    ["GPC", { globalPrivacyControl: true }],
  ])("does not send when %s is active", (_label, privacySignal) => {
    // Given: a browser-level privacy signal and default-enabled local collection.
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("navigator", { ...navigator, ...privacySignal })

    // When: an app-use event is attempted.
    recordUsageEvent("app_use")

    // Then: the browser signal overrides the default preference.
    expect(isUsageCollectionEnabled()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back to memory when browser storage is blocked", async () => {
    // Given: both storage getters throw security errors.
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })

    // When: the same app-use event is attempted twice.
    recordUsageEvent("app_use")
    recordUsageEvent("app_use")
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Then: memory deduplication prevents a duplicate without failing the app.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps opt-out and deduplication when storage reads work but writes fail", async () => {
    // Given: quota failures prevent preference and session flag writes.
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })

    // When: the user opts out, then later enables collection and repeats one app event.
    setUsageCollectionEnabled(false)
    expect(isUsageCollectionEnabled()).toBe(false)
    setUsageCollectionEnabled(true)
    recordUsageEvent("app_use")
    recordUsageEvent("app_use")
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Then: the memory fallback preserves both privacy state and tab deduplication.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps an in-session opt-out ahead of a stale persisted enabled value", () => {
    // Given: collection was previously enabled and the next storage write will fail.
    localStorage.setItem("sevenview:usage-enabled", "enabled")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })

    // When: the user turns collection off and app use follows in the same page session.
    setUsageCollectionEnabled(false)
    recordUsageEvent("app_use")

    // Then: the failed write cannot revive the stale enabled value or cause a request.
    expect(isUsageCollectionEnabled()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not retry an offline request", async () => {
    // Given: the collector is offline.
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"))
    vi.stubGlobal("fetch", fetchMock)

    // When: an export completion is recorded.
    recordUsageEvent("export_complete")
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Then: the rejected request remains a single non-blocking attempt.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("aborts a slow request after the bounded timeout", async () => {
    // Given: a collector request that remains pending until its signal aborts.
    vi.useFakeTimers()
    let capturedSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_input: URL | RequestInfo, init?: RequestInit) => {
      capturedSignal = init?.signal instanceof AbortSignal ? init.signal : undefined
      return new Promise<Response>((resolve) => {
        capturedSignal?.addEventListener("abort", () =>
          resolve(new Response(null, { status: 499 })),
        )
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    // When: the timeout budget elapses.
    recordUsageEvent("export_complete")
    await vi.advanceTimersByTimeAsync(1_500)

    // Then: the single best-effort request is aborted and never retried.
    expect(capturedSignal?.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
