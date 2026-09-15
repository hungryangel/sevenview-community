const WELCOME_VERSION_KEY = "sevenview:welcome-version"
let memoryVersion: string | null = null

function welcomeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch (error: unknown) {
    if (error instanceof Error || error instanceof DOMException) return null
    throw error
  }
}

export function shouldShowWelcome(version: string): boolean {
  const storage = welcomeStorage()
  if (storage === null) return memoryVersion !== version
  try {
    return storage.getItem(WELCOME_VERSION_KEY) !== version
  } catch (error: unknown) {
    if (error instanceof Error || error instanceof DOMException) return memoryVersion !== version
    throw error
  }
}

export function markWelcomeSeen(version: string): void {
  memoryVersion = version
  const storage = welcomeStorage()
  if (storage === null) return
  try {
    storage.setItem(WELCOME_VERSION_KEY, version)
  } catch (error: unknown) {
    if (!(error instanceof Error || error instanceof DOMException)) throw error
  }
}

export { WELCOME_VERSION_KEY }
