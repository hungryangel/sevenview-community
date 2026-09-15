import type { ImageSize, RegistrationAnchors } from "./types"

export type AnalysisJourneyItem = {
  readonly anchors: RegistrationAnchors | null
  readonly index: number
  readonly sourceSize?: ImageSize
}

type JourneyBase = {
  readonly generation: number
  readonly items: readonly AnalysisJourneyItem[]
  readonly totalItems: number
}

export type AnalysisJourney =
  | (JourneyBase & { readonly kind: "originals" })
  | (JourneyBase & { readonly kind: "detecting"; readonly completedItems: number })
  | (JourneyBase & { readonly kind: "settling" })
  | (JourneyBase & { readonly kind: "complete" })
  | (JourneyBase & { readonly kind: "error"; readonly message: string })
  | (JourneyBase & { readonly kind: "cancelled" })

export type AnalysisJourneyEvent =
  | {
      readonly type: "itemDetected"
      readonly generation: number
      readonly index: number
      readonly anchors?: RegistrationAnchors
      readonly sourceSize?: ImageSize
    }
  | { readonly type: "settled" | "completed" | "cancelled"; readonly generation: number }
  | { readonly type: "failed"; readonly generation: number; readonly message: string }

export function beginAnalysisJourney(generation: number, totalItems: number): AnalysisJourney {
  return { kind: "originals", generation, items: [], totalItems }
}

export function advanceAnalysisJourney(
  state: AnalysisJourney,
  event: AnalysisJourneyEvent,
): AnalysisJourney {
  if (
    event.generation !== state.generation ||
    state.kind === "complete" ||
    state.kind === "error" ||
    state.kind === "cancelled"
  ) {
    return state
  }
  switch (event.type) {
    case "itemDetected": {
      if (event.index < 0 || event.index >= state.totalItems) return state
      const item = {
        index: event.index,
        anchors: event.anchors ?? null,
        ...(event.sourceSize === undefined ? {} : { sourceSize: event.sourceSize }),
      }
      const items = [
        ...state.items.filter((candidate) => candidate.index !== event.index),
        item,
      ].sort((left, right) => left.index - right.index)
      return {
        kind: "detecting",
        generation: state.generation,
        items,
        totalItems: state.totalItems,
        completedItems: items.length,
      }
    }
    case "settled":
      return state.kind === "detecting" ? { ...state, kind: "settling" } : state
    case "completed":
      return state.kind === "settling" ? { ...state, kind: "complete" } : state
    case "cancelled":
      return { ...state, kind: "cancelled" }
    case "failed":
      return { ...state, kind: "error", message: event.message }
  }
}
