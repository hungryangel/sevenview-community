import { useCallback, useEffect, useState } from "react"

// 기준선 두께(2026-09-03 bee 제안): 사진 해상도·화면 크기에 따라 잘 보이는 두께가 달라 사용자가 고른다.
// 색과 같은 방식 — :root[data-guide-width]가 --guide-width를 정하고, 값은 이 브라우저에만 저장한다.
export type GuideWidthId = "thin" | "regular" | "bold"

export type GuideWidthOption = {
  readonly id: GuideWidthId
  readonly label: string
  readonly px: number
}

export const GUIDE_WIDTHS: readonly GuideWidthOption[] = [
  { id: "thin", label: "가늘게", px: 1 },
  { id: "regular", label: "보통", px: 2 },
  { id: "bold", label: "굵게", px: 3 },
]

export const DEFAULT_GUIDE_WIDTH: GuideWidthId = "regular"
export const GUIDE_WIDTH_STORAGE_KEY = "sevenview.guide-width.v1"

export function isGuideWidthId(value: unknown): value is GuideWidthId {
  return typeof value === "string" && GUIDE_WIDTHS.some((option) => option.id === value)
}

export function readStoredGuideWidth(storage: Pick<Storage, "getItem"> | null): GuideWidthId {
  try {
    const stored = storage?.getItem(GUIDE_WIDTH_STORAGE_KEY)
    return isGuideWidthId(stored) ? stored : DEFAULT_GUIDE_WIDTH
  } catch {
    return DEFAULT_GUIDE_WIDTH
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function applyGuideWidth(root: HTMLElement, width: GuideWidthId): void {
  root.dataset["guideWidth"] = width
}

export function useGuideWidth(): readonly [GuideWidthId, (next: GuideWidthId) => void] {
  const [width, setWidth] = useState<GuideWidthId>(() => readStoredGuideWidth(localStorageOrNull()))

  useEffect(() => {
    applyGuideWidth(document.documentElement, width)
  }, [width])

  const change = useCallback((next: GuideWidthId) => {
    setWidth(next)
    try {
      localStorageOrNull()?.setItem(GUIDE_WIDTH_STORAGE_KEY, next)
    } catch {
      // 저장소가 막힌 환경이면 이 탭에서만 유지된다.
    }
  }, [])

  return [width, change]
}
