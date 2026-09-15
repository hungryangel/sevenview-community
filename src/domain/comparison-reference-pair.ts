import type { ComparisonSide } from "./comparison"
import type { RegistrationReferences } from "./comparison-registration"
import type { Point } from "./types"

export type ComparisonReferencePair = Readonly<Record<ComparisonSide, RegistrationReferences>>
export type ReferenceOrdinal = "first" | "second"
export type ReferenceStep =
  | { readonly kind: "place"; readonly side: ComparisonSide; readonly ordinal: ReferenceOrdinal }
  | { readonly kind: "confirm"; readonly ordinal: ReferenceOrdinal }
  | { readonly kind: "preview" }

export type ComparisonReferenceDraft = {
  readonly references: Readonly<Partial<Record<ComparisonSide, Partial<RegistrationReferences>>>>
  readonly step: ReferenceStep
  readonly confirmed: readonly ReferenceOrdinal[]
}

export type ComparisonReferenceAction =
  | {
      readonly type: "place"
      readonly side: ComparisonSide
      readonly ordinal: ReferenceOrdinal
      readonly point: Point
    }
  | { readonly type: "confirm" }
  | { readonly type: "revise"; readonly ordinal: ReferenceOrdinal }

export function createComparisonReferenceDraft(
  initial: Readonly<Partial<Record<ComparisonSide, RegistrationReferences>>> = {},
): ComparisonReferenceDraft {
  return {
    confirmed: [],
    references: initial,
    step: { kind: "place", side: "before", ordinal: "first" },
  }
}

export function comparisonReferenceReducer(
  state: ComparisonReferenceDraft,
  action: ComparisonReferenceAction,
): ComparisonReferenceDraft {
  if (action.type === "revise")
    return {
      ...state,
      confirmed: state.confirmed.filter((ordinal) => ordinal !== action.ordinal),
      step: { kind: "place", side: "before", ordinal: action.ordinal },
    }
  if (action.type === "confirm") {
    if (state.step.kind !== "confirm") return state
    const confirmed = state.confirmed.includes(state.step.ordinal)
      ? state.confirmed
      : [...state.confirmed, state.step.ordinal]
    return {
      ...state,
      confirmed,
      step:
        state.step.ordinal === "first"
          ? { kind: "place", side: "before", ordinal: "second" }
          : confirmed.includes("first")
            ? { kind: "preview" }
            : { kind: "place", side: "before", ordinal: "first" },
    }
  }
  if (
    state.step.kind !== "place" ||
    state.step.side !== action.side ||
    state.step.ordinal !== action.ordinal
  )
    return state
  const sideReferences = state.references[action.side] ?? {}
  const references = {
    ...state.references,
    [action.side]: { ...sideReferences, [action.ordinal]: action.point },
  }
  const step: ReferenceStep =
    action.side === "before"
      ? { kind: "place", side: "after", ordinal: action.ordinal }
      : { kind: "confirm", ordinal: action.ordinal }
  return { ...state, references, step }
}

function validPoint(point: Point | undefined): point is Point {
  return (
    point !== undefined &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  )
}

export function completeReferencePair(
  draft: ComparisonReferenceDraft,
): ComparisonReferencePair | null {
  if (!draft.confirmed.includes("first") || !draft.confirmed.includes("second")) return null
  const before = draft.references.before
  const after = draft.references.after
  if (
    !validPoint(before?.first) ||
    !validPoint(before.second) ||
    !validPoint(after?.first) ||
    !validPoint(after.second)
  )
    return null
  if (Math.hypot(before.second.x - before.first.x, before.second.y - before.first.y) < 1e-4)
    return null
  if (Math.hypot(after.second.x - after.first.x, after.second.y - after.first.y) < 1e-4) return null
  return {
    before: { first: before.first, second: before.second },
    after: { first: after.first, second: after.second },
  }
}

export function referencePairError(draft: ComparisonReferenceDraft): string | null {
  if (draft.step.kind !== "preview") return null
  const before = draft.references.before
  const after = draft.references.after
  if (
    !validPoint(before?.first) ||
    !validPoint(before.second) ||
    !validPoint(after?.first) ||
    !validPoint(after.second)
  )
    return "두 사진의 기준점 두 쌍을 모두 선택해 주세요."
  if (
    Math.hypot(before.second.x - before.first.x, before.second.y - before.first.y) < 1e-4 ||
    Math.hypot(after.second.x - after.first.x, after.second.y - after.first.y) < 1e-4
  )
    return "각 사진에서 기준점 ①과 ②를 서로 떨어진 위치에 놓아 주세요."
  return null
}
