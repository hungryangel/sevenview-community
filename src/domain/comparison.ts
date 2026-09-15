export const COMPARISON_SIDES = ["before", "after"] as const
export type ComparisonSide = (typeof COMPARISON_SIDES)[number]

export const COMPARISON_VIEW_MODES = ["sideBySide", "wipe", "toggle"] as const
export type ComparisonViewMode = (typeof COMPARISON_VIEW_MODES)[number]

export const COMPARISON_ANGLES = [
  "front",
  "rightOblique",
  "leftOblique",
  "rightProfile",
  "leftProfile",
] as const
export type ComparisonAngle = (typeof COMPARISON_ANGLES)[number]

export type ComparisonPair<T> = {
  readonly before: T | null
  readonly after: T | null
}

export type ReadyComparisonPair<T> = {
  readonly before: T
  readonly after: T
}

export function isComparisonPairReady<T>(pair: ComparisonPair<T>): pair is ReadyComparisonPair<T> {
  return pair.before !== null && pair.after !== null
}
