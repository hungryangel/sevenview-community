import { describe, expect, it } from "vitest"
import { type PhotoPose, photoId } from "../src/domain/types"
import { VIEW_SETS } from "../src/domain/view-set"
import {
  buildReviewQueue,
  buildWorkspaceReviewQueue,
  nextReviewView,
  previousReviewView,
  type ReviewIssue,
} from "../src/product/review-queue"

function pose(patch: Partial<PhotoPose> = {}): PhotoPose {
  return {
    anchor: { x: 0.5, y: 0.5 },
    bounds: { bottom: 0.85, left: 0.25, right: 0.75, top: 0.15 },
    confidence: 0.94,
    id: photoId("review-queue-photo"),
    pitchScore: 0.5,
    rollDegrees: 0,
    yawScore: 0,
    ...patch,
  }
}

const tiltedDiagnosticSource = {
  failures: [],
  lateralityConflictViews: [],
  mixupViews: [],
  photos: [{ pose: pose({ rollDegrees: 8 }), view: "leftOblique" }],
  poseMismatchViews: [],
} as const

describe("review queue", () => {
  it("orders one item per active seven-view slot and de-duplicates its reasons", () => {
    // Given: unordered issues, including two kinds and a duplicate for one photo.
    const issues = [
      { kind: "diagnostic", view: "leftProfile" },
      { kind: "detectionWeak", view: "front" },
      { kind: "poseMismatch", view: "leftProfile" },
      { kind: "diagnostic", view: "leftProfile" },
    ] satisfies readonly ReviewIssue[]

    // When: the active protocol builds its queue.
    const queue = buildReviewQueue(VIEW_SETS.standardSeven, issues)

    // Then: active view order wins and one photo carries unique reason kinds.
    expect(queue).toEqual([
      { reasons: ["detectionWeak"], view: "front" },
      { reasons: ["diagnostic", "poseMismatch"], view: "leftProfile" },
    ])
  })

  it("ignores issue reasons outside the active six-view set", () => {
    // Given: a six-view protocol and issues both inside and outside it.
    const issues = [
      { kind: "diagnostic", view: "crownDown" },
      { kind: "analysisFailure", view: "frontSmile" },
      { kind: "mixup", view: "rightProfile" },
    ] satisfies readonly ReviewIssue[]

    // When: the active protocol builds its queue.
    const queue = buildReviewQueue(VIEW_SETS.dentalSix, issues)

    // Then: only active slots remain in deterministic protocol order.
    expect(queue).toEqual([
      { reasons: ["analysisFailure"], view: "frontSmile" },
      { reasons: ["mixup"], view: "rightProfile" },
    ])
  })

  it("includes a visible diagnostic through the production composition seam", () => {
    // Given: a tilted photo with no dismissed diagnostic keys.
    const source = { ...tiltedDiagnosticSource, dismissedDiagnosticKeys: [] }

    // When: Workspace's production queue derivation composes visible issues.
    const queue = buildWorkspaceReviewQueue(VIEW_SETS.standardSeven, source)

    // Then: the photo is queued for its visible diagnostic.
    expect(queue).toEqual([{ reasons: ["diagnostic"], view: "leftOblique" }])
  })

  it("removes a diagnostic through the production dismissal-filtering seam", () => {
    // Given: the same tilted photo with its real roll dismissal key.
    const source = {
      ...tiltedDiagnosticSource,
      dismissedDiagnosticKeys: ["leftOblique:roll"],
    }

    // When: Workspace's production queue derivation rebuilds visible issues.
    const queue = buildWorkspaceReviewQueue(VIEW_SETS.standardSeven, source)

    // Then: the dismissed diagnostic does not survive as stale queue state.
    expect(queue).toEqual([])
  })

  it("keeps a diagnostic when the dismissal key belongs to another view", () => {
    // Given: the same tilted photo and a nonmatching view's roll dismissal key.
    const source = {
      ...tiltedDiagnosticSource,
      dismissedDiagnosticKeys: ["rightOblique:roll"],
    }

    // When: Workspace's production queue derivation filters visible diagnostics.
    const queue = buildWorkspaceReviewQueue(VIEW_SETS.standardSeven, source)

    // Then: the left-oblique diagnostic remains visible.
    expect(queue).toEqual([{ reasons: ["diagnostic"], view: "leftOblique" }])
  })

  it("returns null navigation targets for an empty queue", () => {
    // Given: no active review issues.
    const queue = buildReviewQueue(VIEW_SETS.standardSeven, [])

    // When/Then: both navigation directions remain total and non-throwing.
    expect(nextReviewView(queue, "front")).toBeNull()
    expect(previousReviewView(queue, "front")).toBeNull()
  })

  it("wraps next and previous navigation for seven-view queues", () => {
    // Given: issues at the first, middle, and last protocol slots.
    const queue = buildReviewQueue(VIEW_SETS.standardSeven, [
      { kind: "detectionWeak", view: "front" },
      { kind: "poseMismatch", view: "leftProfile" },
      { kind: "diagnostic", view: "crownDown" },
    ])

    // When/Then: navigation advances and wraps in both directions.
    expect(nextReviewView(queue, "front")).toBe("leftProfile")
    expect(nextReviewView(queue, "crownDown")).toBe("front")
    expect(previousReviewView(queue, "leftProfile")).toBe("front")
    expect(previousReviewView(queue, "front")).toBe("crownDown")
  })

  it("starts deterministic navigation at an edge when the current view is outside the queue", () => {
    // Given: a six-view queue that does not contain the selected view.
    const queue = buildReviewQueue(VIEW_SETS.dentalSix, [
      { kind: "mixup", view: "frontSmile" },
      { kind: "analysisFailure", view: "leftProfile" },
    ])

    // When/Then: next starts first and previous starts last.
    expect(nextReviewView(queue, "front")).toBe("frontSmile")
    expect(previousReviewView(queue, "front")).toBe("leftProfile")
  })
})
