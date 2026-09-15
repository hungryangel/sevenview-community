import { useCallback, useEffect, useState } from "react"

import {
  isUsageCollectionEnabled,
  setUsageCollectionEnabled,
  syncUsagePreferenceFromStorage,
  USAGE_PREFERENCE_KEY,
} from "./usage-events"

export function useUsagePreference(): readonly [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(isUsageCollectionEnabled)

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === USAGE_PREFERENCE_KEY) {
        syncUsagePreferenceFromStorage()
        setEnabled(isUsageCollectionEnabled())
      }
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  const update = useCallback((next: boolean) => {
    setUsageCollectionEnabled(next)
    setEnabled(isUsageCollectionEnabled())
  }, [])

  return [enabled, update] as const
}
