import { describe, expect, it } from "vitest"

import {
  ComparisonTransitionError,
  comparisonSessionReducer,
  createComparisonSession,
  isComparisonExportReady,
} from "../src/domain/comparison-session"
import { photoId } from "../src/domain/types"

const before = new File(["before"], "before.jpg", { type: "image/jpeg" })
const after = new File(["after"], "after.jpg", { type: "image/jpeg" })

describe("comparisonSessionReducer", () => {
  it("removes one semantic side without changing the other", () => {
    const before = new File(["before"], "before.jpg", { type: "image/jpeg" })
    const after = new File(["after"], "after.jpg", { type: "image/jpeg" })
    const selectedBefore = comparisonSessionReducer(createComparisonSession(), {
      type: "select",
      side: "before",
      file: before,
      previewUrl: "blob:before",
    })
    const selectedBoth = comparisonSessionReducer(selectedBefore, {
      type: "select",
      side: "after",
      file: after,
      previewUrl: "blob:after",
    })

    const result = comparisonSessionReducer(selectedBoth, { type: "remove", side: "before" })

    expect(result.before.kind).toBe("empty")
    expect(result.after).toEqual(selectedBoth.after)
  })

  it("moves each labelled side through pending, analyzing, and ready without swapping", () => {
    // Given: an empty comparison session.
    let state = createComparisonSession<string>()

    // When: both labelled files complete successfully.
    state = comparisonSessionReducer(state, {
      type: "select",
      side: "before",
      file: before,
      previewUrl: "blob:before",
    })
    state = comparisonSessionReducer(state, {
      type: "select",
      side: "after",
      file: after,
      previewUrl: "blob:after",
    })
    state = comparisonSessionReducer(state, { type: "start", sides: ["before", "after"] })
    state = comparisonSessionReducer(state, {
      type: "ready",
      side: "before",
      file: before,
      decoded: { image: "before-image", width: 800, height: 1000 },
      pose: {
        id: photoId("photo-1"),
        yawScore: 0,
        pitchScore: 0,
        rollDegrees: 0,
        confidence: 0.9,
        bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
        anchor: { x: 0.5, y: 0.5 },
      },
    })
    state = comparisonSessionReducer(state, {
      type: "ready",
      side: "after",
      file: after,
      decoded: { image: "after-image", width: 800, height: 1000 },
      pose: {
        id: photoId("photo-2"),
        yawScore: 0,
        pitchScore: 0,
        rollDegrees: 0,
        confidence: 0.9,
        bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
        anchor: { x: 0.5, y: 0.5 },
      },
    })

    // Then: the session is reviewable and export-ready with labels intact.
    expect(state.phase).toBe("review")
    expect(state.before.kind).toBe("ready")
    expect(state.after.kind).toBe("ready")
    expect(isComparisonExportReady(state)).toBe(true)
  })

  it("keeps a ready side when the other side fails and permits targeted retry", () => {
    // Given: Before is ready while After is still analyzing.
    let state = createComparisonSession<string>()
    state = comparisonSessionReducer(state, {
      type: "select",
      side: "before",
      file: before,
      previewUrl: "blob:before",
    })
    state = comparisonSessionReducer(state, {
      type: "select",
      side: "after",
      file: after,
      previewUrl: "blob:after",
    })
    state = comparisonSessionReducer(state, { type: "start", sides: ["before", "after"] })
    state = comparisonSessionReducer(state, {
      type: "ready",
      side: "before",
      file: before,
      decoded: { image: "before-image", width: 800, height: 1000 },
      pose: {
        id: photoId("photo-1"),
        yawScore: 0,
        pitchScore: 0,
        rollDegrees: 0,
        confidence: 0.9,
        bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
        anchor: { x: 0.5, y: 0.5 },
      },
    })

    // When: After fails and is retried.
    state = comparisonSessionReducer(state, {
      type: "error",
      side: "after",
      file: after,
      code: "face_not_detected",
    })
    const partial = state
    state = comparisonSessionReducer(state, { type: "start", sides: ["after"] })

    // Then: Before remains ready, export stays disabled, and only After analyzes.
    expect(partial.phase).toBe("review")
    expect(partial.before.kind).toBe("ready")
    expect(partial.after.kind).toBe("error")
    expect(isComparisonExportReady(partial)).toBe(false)
    expect(state.before.kind).toBe("ready")
    expect(state.after.kind).toBe("analyzing")
  })

  it("rejects a ready result for a side that was never analyzing", () => {
    // Given: an empty session.
    const state = createComparisonSession<string>()

    // When/Then: an impossible completion is rejected explicitly.
    expect(() =>
      comparisonSessionReducer(state, {
        type: "ready",
        side: "before",
        file: before,
        decoded: { image: "stale", width: 1, height: 1 },
        pose: {
          id: photoId("photo-1"),
          yawScore: 0,
          pitchScore: 0,
          rollDegrees: 0,
          confidence: 0.9,
          bounds: { left: 0, top: 0, right: 1, bottom: 1 },
          anchor: { x: 0.5, y: 0.5 },
        },
      }),
    ).toThrow(ComparisonTransitionError)
  })
})
