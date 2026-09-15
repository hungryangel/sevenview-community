// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import type { SessionPhotoMeta } from "../src/domain/session-mixup"
import { VIEW_SETS } from "../src/domain/view-set"
import { buildWorkspaceReviewQueue } from "../src/product/review-queue"
import { buildWorkspaceSetOverview } from "../src/product/workspace-set-overview-model"
import {
  overviewFailure,
  overviewPhoto,
  overviewWorkspace,
} from "./workspace-set-overview-fixtures"

describe("workspace set overview", () => {
  it("separates an occupied failure from missing slots and shares the review queue", () => {
    // Given: one clean photo, one weak photo, one failure and four empty views.
    const workspace = {
      ...overviewWorkspace(),
      failures: [overviewFailure("leftOblique")],
      photos: [
        overviewPhoto("front"),
        {
          ...overviewPhoto("rightOblique"),
          pose: { ...overviewPhoto("rightOblique").pose, confidence: 0.1 },
        },
      ],
    }
    const queue = buildWorkspaceReviewQueue(workspace.viewSet, {
      dismissedDiagnosticKeys: [],
      failures: workspace.failures,
      lateralityConflictViews: [],
      mixupViews: [],
      photos: workspace.photos,
      poseMismatchViews: [],
    })

    // When: the overview projects the same review sources as the editor.
    const overview = buildWorkspaceSetOverview(workspace, queue)

    // Then: placement, review, failure and absence remain distinct.
    expect(overview.counts).toEqual({
      included: 2,
      missing: 4,
      review: 2,
      failed: 1,
      spares: 0,
      trayFailures: 0,
    })
    expect(overview.views.map(({ status }) => status)).toEqual([
      "placed",
      "review",
      "failure",
      "empty",
      "empty",
      "empty",
      "empty",
    ])
  })

  it("follows the active six-view protocol and keeps extra sources outside output", () => {
    // Given: one active photo, an out-of-protocol photo, a spare and tray failure.
    const workspace = {
      ...overviewWorkspace(),
      failures: [overviewFailure("chinUp")],
      photos: [overviewPhoto("frontSmile"), overviewPhoto("crownDown")],
      spares: [overviewPhoto("leftOblique")],
      trayFailures: [overviewFailure("rightProfile")],
      viewSet: VIEW_SETS.dentalSix,
    }

    // When: the active protocol is projected, including a queue item from an old protocol.
    const overview = buildWorkspaceSetOverview(workspace, [
      { view: "crownDown", reasons: ["mixup"] },
    ])

    // Then: only six protocol views count toward the sheet.
    expect(overview.views.map(({ view }) => view)).toEqual(VIEW_SETS.dentalSix.views)
    expect(overview.counts).toEqual({
      included: 1,
      missing: 5,
      review: 0,
      failed: 0,
      spares: 2,
      trayFailures: 2,
    })
  })

  it("keeps capture dates unknown when EXIF is absent despite a date-shaped session name", () => {
    // Given: an assigned photo without capture metadata and a generated session name.
    const workspace = { ...overviewWorkspace(), photos: [overviewPhoto("front")] }

    // When: capture days are projected.
    const overview = buildWorkspaceSetOverview(workspace, [])

    // Then: the name is never substituted for the missing capture date.
    expect(overview.captureDates).toEqual({ days: [], knownCount: 0, totalCount: 1 })
  })

  it("preserves local EXIF calendar days across multiple dates and partial metadata", () => {
    // Given: two dated assigned photos, an undated photo and a dated assigned failure.
    const metas = new Map<string, SessionPhotoMeta>([
      [
        "front",
        {
          camera: null,
          captureTime: new Date(2026, 8, 7, 0, 5),
          fileName: "front.png",
          key: "front",
        },
      ],
      [
        "rightOblique",
        {
          camera: null,
          captureTime: new Date(2026, 8, 9, 23, 55),
          fileName: "right.png",
          key: "rightOblique",
        },
      ],
      [
        "file:leftProfile.png",
        {
          camera: null,
          captureTime: new Date(2026, 8, 7, 12),
          fileName: "leftProfile.png",
          key: "file:leftProfile.png",
        },
      ],
      [
        "crownDown",
        {
          camera: null,
          captureTime: new Date(2020, 0, 1),
          fileName: "spare.png",
          key: "crownDown",
        },
      ],
    ])
    const workspace = {
      ...overviewWorkspace(),
      failures: [overviewFailure("leftProfile")],
      getPhotoMeta: (key: string) => metas.get(key),
      photos: [overviewPhoto("front"), overviewPhoto("rightOblique"), overviewPhoto("leftOblique")],
      spares: [overviewPhoto("crownDown")],
    }

    // When: the overview resolves capture dates for occupied protocol slots.
    const overview = buildWorkspaceSetOverview(workspace, [])

    // Then: actual days stay distinct, missing metadata stays visible and spare dates stay out.
    expect(overview.captureDates).toEqual({
      days: ["2026-09-07", "2026-09-09"],
      knownCount: 3,
      totalCount: 4,
    })
  })
})
