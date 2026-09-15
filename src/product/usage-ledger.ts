// 사용량 장부(2026-09-02 bee 요청): 이 브라우저에서 정렬한 세트·사진 수와 내보내기 횟수를
// 사용자 화면에 바로 보여준다. 로컬 저장소에만 쌓이며(전송 0), 저장소가 막힌 환경에서는
// 세션 값만 보입니다.
export type UsageLedger = {
  readonly exports: number
  readonly photos: number
  readonly sets: number
}

export const EMPTY_USAGE_LEDGER: UsageLedger = { exports: 0, photos: 0, sets: 0 }
export const USAGE_LEDGER_STORAGE_KEY = "sevenview.usage.v1"

type LedgerStorage = Pick<Storage, "getItem" | "setItem">

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

export function parseUsageLedger(raw: string | null): UsageLedger {
  if (raw === null) {
    return EMPTY_USAGE_LEDGER
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      return EMPTY_USAGE_LEDGER
    }
    const record = parsed as Record<string, unknown>
    return {
      exports: toCount(record["exports"]),
      photos: toCount(record["photos"]),
      sets: toCount(record["sets"]),
    }
  } catch {
    return EMPTY_USAGE_LEDGER
  }
}

export function readUsageLedger(storage: LedgerStorage | null): UsageLedger {
  try {
    return parseUsageLedger(storage?.getItem(USAGE_LEDGER_STORAGE_KEY) ?? null)
  } catch {
    return EMPTY_USAGE_LEDGER
  }
}

export function writeUsageLedger(storage: LedgerStorage | null, ledger: UsageLedger): void {
  try {
    storage?.setItem(USAGE_LEDGER_STORAGE_KEY, JSON.stringify(ledger))
  } catch {
    // 저장 실패는 조용히 넘긴다 — 사용량 표시는 편의 기능이다.
  }
}

export function recordAlignedSet(ledger: UsageLedger, photoCount: number): UsageLedger {
  return { ...ledger, photos: ledger.photos + toCount(photoCount), sets: ledger.sets + 1 }
}

export function recordExport(ledger: UsageLedger): UsageLedger {
  return { ...ledger, exports: ledger.exports + 1 }
}

export function localStorageOrNull(): LedgerStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
