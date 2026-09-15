export const USAGE_EVENTS = ["landing_visit", "app_use", "export_complete"] as const
export type UsageEvent = (typeof USAGE_EVENTS)[number]

const OFFICIAL_HOST = "sevenview.velnoc.com"
const USAGE_PREFERENCE_KEY = "sevenview:usage-enabled"
const SESSION_PREFIX = "sevenview:usage-sent:"
const REQUEST_TIMEOUT_MS = 1_500

type UsagePreference = "enabled" | "disabled"

const memorySent = new Set<UsageEvent>()
let memoryPreference: UsagePreference = "enabled"
let memoryPreferenceOverride: UsagePreference | null = null

function isStorageError(error: unknown): error is Error | DOMException {
  return error instanceof Error || error instanceof DOMException
}

function browserStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage
  } catch (error: unknown) {
    if (isStorageError(error)) return null
    throw error
  }
}

function readPreference(): UsagePreference {
  if (memoryPreferenceOverride !== null) return memoryPreferenceOverride
  const storage = browserStorage("local")
  if (storage === null) return memoryPreference
  try {
    const stored = storage.getItem(USAGE_PREFERENCE_KEY)
    if (stored === "disabled" || stored === "enabled") return stored
    return memoryPreference
  } catch (error: unknown) {
    if (isStorageError(error)) return memoryPreference
    throw error
  }
}

function hasPrivacySignal(): boolean {
  return navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true
}

export function isUsageCollectionEnabled(): boolean {
  return readPreference() === "enabled" && !hasPrivacySignal()
}

export function setUsageCollectionEnabled(enabled: boolean): void {
  memoryPreference = enabled ? "enabled" : "disabled"
  const storage = browserStorage("local")
  if (storage === null) {
    memoryPreferenceOverride = memoryPreference
    return
  }
  try {
    storage.setItem(USAGE_PREFERENCE_KEY, memoryPreference)
    memoryPreferenceOverride = null
  } catch (error: unknown) {
    memoryPreferenceOverride = memoryPreference
    if (!isStorageError(error)) throw error
  }
}

export function syncUsagePreferenceFromStorage(): void {
  memoryPreferenceOverride = null
}

export function isOfficialUsageLocation(
  location: Pick<Location, "protocol" | "hostname"> = window.location,
): boolean {
  return location.protocol === "https:" && location.hostname === OFFICIAL_HOST
}

export function parseUsageEndpoint(value: string | undefined): URL | null {
  if (value === undefined) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" &&
      url.pathname === "/events" &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === ""
      ? url
      : null
  } catch (error: unknown) {
    if (error instanceof TypeError) return null
    throw error
  }
}

function isAlreadySent(event: UsageEvent): boolean {
  if (event === "export_complete") return false
  const storage = browserStorage("session")
  if (storage === null) return memorySent.has(event)
  try {
    return storage.getItem(`${SESSION_PREFIX}${event}`) === "1" || memorySent.has(event)
  } catch (error: unknown) {
    if (isStorageError(error)) return memorySent.has(event)
    throw error
  }
}

function markSent(event: UsageEvent): void {
  if (event === "export_complete") return
  memorySent.add(event)
  const storage = browserStorage("session")
  if (storage === null) return
  try {
    storage.setItem(`${SESSION_PREFIX}${event}`, "1")
  } catch (error: unknown) {
    if (!isStorageError(error)) throw error
  }
}

async function transmit(event: UsageEvent, endpoint: URL): Promise<void> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    // Native fetch is intentional at this best-effort boundary: the product contract forbids
    // retries/outboxes and requires explicit credentials, referrer and AbortSignal policies.
    await fetch(endpoint, {
      body: JSON.stringify({ event }),
      credentials: "omit",
      headers: { "content-type": "application/json" },
      method: "POST",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    })
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function recordUsageEvent(event: UsageEvent): void {
  if (!isOfficialUsageLocation() || !isUsageCollectionEnabled() || isAlreadySent(event)) return
  if (event === "landing_visit" && window.location.pathname !== "/") return
  const endpoint = parseUsageEndpoint(import.meta.env.VITE_USAGE_ENDPOINT)
  if (endpoint === null) return
  markSent(event)
  void transmit(event, endpoint)
}

export function resetUsageMemoryForTests(): void {
  memorySent.clear()
  memoryPreference = "enabled"
  memoryPreferenceOverride = null
}

export { USAGE_PREFERENCE_KEY }
