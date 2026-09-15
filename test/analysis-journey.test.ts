import { describe, expect, it } from "vitest"

import { advanceAnalysisJourney, beginAnalysisJourney } from "../src/domain/analysis-journey"

describe("analysis journey", () => {
  it("records only real milestones from the current generation", () => {
    const started = beginAnalysisJourney(4, 2)
    const detecting = advanceAnalysisJourney(started, {
      type: "itemDetected",
      generation: 4,
      index: 0,
      anchors: {
        screenLeftEye: { x: 0.3, y: 0.4 },
        screenRightEye: { x: 0.7, y: 0.4 },
        noseTip: { x: 0.5, y: 0.55 },
      },
    })

    expect(detecting).toMatchObject({ kind: "detecting", completedItems: 1 })
    expect(advanceAnalysisJourney(detecting, { type: "settled", generation: 3 })).toBe(detecting)
    expect(advanceAnalysisJourney(detecting, { type: "settled", generation: 4 })).toMatchObject({
      kind: "settling",
    })
  })

  it("keeps missing anchors explicit and cancellation terminal", () => {
    const started = beginAnalysisJourney(2, 1)
    const detected = advanceAnalysisJourney(started, {
      type: "itemDetected",
      generation: 2,
      index: 0,
    })
    expect(detected.items[0]).toEqual({ index: 0, anchors: null })
    expect(advanceAnalysisJourney(detected, { type: "cancelled", generation: 2 })).toMatchObject({
      kind: "cancelled",
    })
    const cancelled = advanceAnalysisJourney(detected, { type: "cancelled", generation: 2 })
    expect(
      advanceAnalysisJourney(cancelled, { type: "itemDetected", generation: 2, index: 0 }),
    ).toBe(cancelled)
    expect(advanceAnalysisJourney(started, { type: "itemDetected", generation: 2, index: 1 })).toBe(
      started,
    )
  })
})
