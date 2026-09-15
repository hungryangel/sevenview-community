import { describe, expect, it } from "vitest"
import type { WorkspaceSourcePhoto } from "../src/domain/recovery"
import { photoId } from "../src/domain/types"
import { VIEW_SETS, viewSetRows } from "../src/domain/view-set"
import type { WorkspacePhoto } from "../src/domain/workspace"
import {
  currentViewSetState,
  describeViewSetPreview,
  previewViewSetChange,
} from "../src/product/view-set-preview"

const src = (id: string, yawScore: number, pitchScore: number): WorkspaceSourcePhoto<string> => ({
  image: id,
  pose: {
    id: photoId(id),
    yawScore,
    pitchScore,
    rollDegrees: 0,
    confidence: 0.9,
    bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
    anchor: { x: 0.5, y: 0.5 },
  },
  sourceSize: { width: 800, height: 1000 },
})

// 2026-09-01 합성 7종 실측값(recovery.test.ts와 같은 픽스처).
const measuredSeven = [
  src("front", 0, 0.38),
  src("right-oblique", 0.436, 0.36),
  src("left-oblique", -0.436, 0.367),
  src("right-profile", 1.027, 0.358),
  src("left-profile", -0.952, 0.373),
  src("chin", 0, 0.047),
  src("crown", 0.02, 0.648),
]

describe("previewViewSetChange", () => {
  it("shows what switching to the dental six would do with the current photos, before switching", () => {
    // Given: a full seven-view intake. When: previewing the dental set.
    const preview = previewViewSetChange(measuredSeven, VIEW_SETS.dentalSix)

    // Then: 5 land, 정면 스마일 stays empty (no smiling frontal), 턱밑·정수리 become spares.
    expect(preview.filledViews).toEqual([
      "front",
      "rightOblique",
      "leftOblique",
      "rightProfile",
      "leftProfile",
    ])
    expect(preview.missingViews).toEqual(["frontSmile"])
    expect(preview.spareCount).toBe(2)
    expect(describeViewSetPreview(preview, "ifSwitched")).toBe(
      "바꾸면 5장 배치 · 1개 뷰 미촬영 (정면 스마일) · 예비 2장",
    )
  })

  it("reports no photos honestly instead of a fabricated layout", () => {
    const preview = previewViewSetChange([], VIEW_SETS.dentalSix)

    expect(preview.filledViews).toEqual([])
    expect(preview.missingViews).toEqual(VIEW_SETS.dentalSix.views)
    expect(describeViewSetPreview(preview, "ifSwitched")).toBe(
      "사진 없음 · 다음 정렬부터 이 구성으로 배치합니다",
    )
  })

  it("describes the current set from the actual placement, including manual moves", () => {
    // Given: a reviewer moved the front photo away so 정면 is empty and the crown sits in spares.
    const placed = (
      source: WorkspaceSourcePhoto<string>,
      view: WorkspacePhoto<string>["view"],
    ): WorkspacePhoto<string> => ({
      ...source,
      adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
      assignmentMethod: "manual",
      view,
    })
    const photos = [
      placed(src("right-oblique", 0.436, 0.36), "rightOblique"),
      placed(src("left-oblique", -0.436, 0.367), "leftOblique"),
      placed(src("right-profile", 1.027, 0.358), "rightProfile"),
      placed(src("left-profile", -0.952, 0.373), "leftProfile"),
      placed(src("chin", 0, 0.047), "chinUp"),
    ]
    const state = currentViewSetState(photos, [src("crown", 0.02, 0.648)], VIEW_SETS.standardSeven)

    expect(state.filledViews).toEqual([
      "rightOblique",
      "leftOblique",
      "rightProfile",
      "leftProfile",
      "chinUp",
    ])
    expect(state.missingViews).toEqual(["front", "crownDown"])
    expect(describeViewSetPreview(state, "current")).toBe(
      "지금 5장 배치 · 2개 뷰 미촬영 (정면, 위 (정수리)) · 예비 1장",
    )
  })
})

describe("viewSetRows", () => {
  it("splits the views by the contact-sheet row counts", () => {
    expect(viewSetRows(VIEW_SETS.standardSeven)).toEqual([
      ["front", "rightOblique", "leftOblique", "rightProfile"],
      ["leftProfile", "chinUp", "crownDown"],
    ])
    expect(viewSetRows(VIEW_SETS.dentalSix)).toEqual([
      ["front", "frontSmile", "rightOblique"],
      ["leftOblique", "rightProfile", "leftProfile"],
    ])
  })
})
