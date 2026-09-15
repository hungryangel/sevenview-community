import { useCallback, useEffect, useState } from "react"

// 기준선(중심선·눈높이선) 색(2026-09-03 bee 제안): 사진마다 잘 보이는 색이 달라 사용자가 고른다.
// 화면 전용 오버레이라 내보내는 이미지에는 영향이 없다. 값은 이 브라우저에만 저장한다.
export type GuideColorId = "magenta" | "cyan" | "lime" | "yellow" | "white"

export type GuideColorOption = {
  readonly id: GuideColorId
  readonly label: string
  readonly value: string
}

export const GUIDE_COLORS: readonly GuideColorOption[] = [
  { id: "magenta", label: "마젠타", value: "#ff5fd2" },
  { id: "cyan", label: "시안", value: "#22b0da" },
  { id: "lime", label: "라임", value: "#b6f04c" },
  { id: "yellow", label: "노랑", value: "#ffe45c" },
  { id: "white", label: "흰색", value: "#f2f7f8" },
]

export const DEFAULT_GUIDE_COLOR: GuideColorId = "magenta"
export const GUIDE_COLOR_STORAGE_KEY = "sevenview.guide-color.v1"

export function isGuideColorId(value: unknown): value is GuideColorId {
  return typeof value === "string" && GUIDE_COLORS.some((option) => option.id === value)
}

export function readStoredGuideColor(storage: Pick<Storage, "getItem"> | null): GuideColorId {
  try {
    const stored = storage?.getItem(GUIDE_COLOR_STORAGE_KEY)
    return isGuideColorId(stored) ? stored : DEFAULT_GUIDE_COLOR
  } catch {
    return DEFAULT_GUIDE_COLOR
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// CSS는 :root[data-guide-color]로 --guide-color를 정한다(product-components.css).
export function applyGuideColor(root: HTMLElement, color: GuideColorId): void {
  root.dataset["guideColor"] = color
}

export function useGuideColor(): readonly [GuideColorId, (next: GuideColorId) => void] {
  const [color, setColor] = useState<GuideColorId>(() => readStoredGuideColor(localStorageOrNull()))

  useEffect(() => {
    applyGuideColor(document.documentElement, color)
  }, [color])

  const change = useCallback((next: GuideColorId) => {
    setColor(next)
    try {
      localStorageOrNull()?.setItem(GUIDE_COLOR_STORAGE_KEY, next)
    } catch {
      // 저장소가 막힌 환경이면 이 탭에서만 유지된다.
    }
  }, [])

  return [color, change]
}
