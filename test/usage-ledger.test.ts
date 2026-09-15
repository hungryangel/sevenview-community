import { describe, expect, it } from "vitest"

import {
  EMPTY_USAGE_LEDGER,
  parseUsageLedger,
  readUsageLedger,
  recordAlignedSet,
  recordExport,
  USAGE_LEDGER_STORAGE_KEY,
  writeUsageLedger,
} from "../src/product/usage-ledger"

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    store,
  }
}

describe("usage ledger", () => {
  it("counts aligned sets, photos, and exports and round-trips through storage", () => {
    const storage = memoryStorage()
    let ledger = readUsageLedger(storage)
    expect(ledger).toEqual(EMPTY_USAGE_LEDGER)
    ledger = recordExport(recordAlignedSet(recordAlignedSet(ledger, 7), 5))
    writeUsageLedger(storage, ledger)

    expect(readUsageLedger(storage)).toEqual({ exports: 1, photos: 12, sets: 2 })
    expect(storage.store.get(USAGE_LEDGER_STORAGE_KEY)).toContain('"sets":2')
  })

  it("treats corrupt or foreign values as an empty ledger", () => {
    expect(parseUsageLedger("not json")).toEqual(EMPTY_USAGE_LEDGER)
    expect(parseUsageLedger('{"sets":-3,"photos":"7","exports":2.9}')).toEqual({
      exports: 2,
      photos: 0,
      sets: 0,
    })
    expect(readUsageLedger(null)).toEqual(EMPTY_USAGE_LEDGER)
  })

  it("survives a storage that throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    }
    expect(readUsageLedger(throwing)).toEqual(EMPTY_USAGE_LEDGER)
    expect(() => writeUsageLedger(throwing, EMPTY_USAGE_LEDGER)).not.toThrow()
  })
})
