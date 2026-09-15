import { describe, expect, it } from "vitest"
import {
  comparisonReferenceReducer,
  completeReferencePair,
  createComparisonReferenceDraft,
  referencePairError,
} from "../src/domain/comparison-reference-pair"

describe("paired comparison reference draft", () => {
  it("requires the ordered paired confirmation sequence", () => {
    let draft = createComparisonReferenceDraft()
    draft = comparisonReferenceReducer(draft, {
      type: "place",
      side: "before",
      ordinal: "first",
      point: { x: 0.2, y: 0.2 },
    })
    expect(draft.step).toEqual({ kind: "place", side: "after", ordinal: "first" })
    draft = comparisonReferenceReducer(draft, {
      type: "place",
      side: "after",
      ordinal: "first",
      point: { x: 0.3, y: 0.2 },
    })
    expect(draft.step).toEqual({ kind: "confirm", ordinal: "first" })
    draft = comparisonReferenceReducer(draft, { type: "confirm" })
    expect(draft.step).toEqual({ kind: "place", side: "before", ordinal: "second" })
  })
  it("blocks incomplete and coincident pairs", () => {
    let coincident = createComparisonReferenceDraft()
    const place = (side: "before" | "after", ordinal: "first" | "second", x: number) => {
      coincident = comparisonReferenceReducer(coincident, {
        type: "place",
        side,
        ordinal,
        point: { x, y: 0.2 },
      })
    }
    place("before", "first", 0.2)
    place("after", "first", 0.3)
    coincident = comparisonReferenceReducer(coincident, { type: "confirm" })
    place("before", "second", 0.2)
    place("after", "second", 0.4)
    coincident = comparisonReferenceReducer(coincident, { type: "confirm" })
    expect(completeReferencePair(coincident)).toBeNull()
    expect(referencePairError(coincident)).toMatch(/서로 떨어진/)
    expect(completeReferencePair(createComparisonReferenceDraft())).toBeNull()
  })

  it("ignores out-of-order placement and invalidates confirmation on revision", () => {
    const initial = {
      before: { first: { x: 0.2, y: 0.2 }, second: { x: 0.4, y: 0.4 } },
      after: { first: { x: 0.3, y: 0.2 }, second: { x: 0.5, y: 0.4 } },
    }
    let draft = createComparisonReferenceDraft(initial)
    expect(
      comparisonReferenceReducer(draft, {
        type: "place",
        side: "after",
        ordinal: "second",
        point: { x: 0.9, y: 0.9 },
      }),
    ).toBe(draft)
    draft = comparisonReferenceReducer(draft, {
      type: "place",
      side: "before",
      ordinal: "first",
      point: initial.before.first,
    })
    draft = comparisonReferenceReducer(draft, {
      type: "place",
      side: "after",
      ordinal: "first",
      point: initial.after.first,
    })
    draft = comparisonReferenceReducer(draft, { type: "confirm" })
    expect(completeReferencePair(draft)).toBeNull()
    draft = comparisonReferenceReducer(draft, { type: "revise", ordinal: "first" })
    expect(draft.confirmed).toEqual([])
  })
})
