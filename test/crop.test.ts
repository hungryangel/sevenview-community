import { describe, expect, it } from "vitest"

import { createAutoCrop, createContainCrop, mergeCropAdjustment } from "../src/domain/crop"
import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { projectPointToTarget } from "../src/domain/render-plan"
import { type PhotoPose, photoId } from "../src/domain/types"

const pose: PhotoPose = {
  id: photoId("photo-1"),
  yawScore: 0,
  pitchScore: 0,
  rollDegrees: 8,
  confidence: 0.95,
  bounds: { left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 },
  anchor: { x: 0.5, y: 0.5 },
}

describe("createAutoCrop", () => {
  it("rotates against landmark roll while keeping the target frame fully covered", () => {
    // Given: a tilted face occupying 80% of a 1000px source image.
    const source = { width: 800, height: 1000 }
    const target = { width: 400, height: 500 }

    // When: a standard front crop is created.
    const crop = createAutoCrop({
      framing: FRAMING_PRESETS.closeUp,
      pose,
      source,
      target,
      view: "front",
    })

    // Then: rotation is corrected and the source is never underscaled below
    // the amount needed to cover the whole target frame.
    expect(crop.rotationDegrees).toBe(-8)
    expect(crop.scale).toBeCloseTo(0.586, 3)
    expect(crop.sourceAnchor).toEqual({ x: 400, y: 500 })
    expect(crop.targetAnchor).toEqual({ x: 200, y: 240 })
  })
})

describe("createAutoCrop coverage", () => {
  it("increases a chin-up crop enough to avoid an unfilled source edge", () => {
    // Given: a same-aspect source whose face anchor sits lower than the
    // chin-up composition anchor.
    const crop = createAutoCrop({
      framing: FRAMING_PRESETS.closeUp,
      pose: {
        ...pose,
        anchor: { x: 0.5, y: 0.506 },
        bounds: { left: 0.25, top: 0.13, right: 0.75, bottom: 0.85 },
        rollDegrees: 0,
      },
      source: { width: 384, height: 480 },
      target: { width: 320, height: 400 },
      view: "chinUp",
    })

    // Then: the automatic crop scales beyond the face-only target ratio,
    // so the translated image still reaches the lower output edge.
    expect(crop.scale).toBeCloseTo(0.945, 3)
  })
})

describe("framing presets", () => {
  // 2026-09-02 소유자 결정(2안): 기본 프레이밍은 임상 문서 표준 —
  // 이마~턱 52%·중점 50%면 정수리 여백 ~9%·쇄골이 하단에 온다.
  const roomyPose: PhotoPose = {
    ...pose,
    bounds: { left: 0.35, top: 0.4, right: 0.65, bottom: 0.6 },
    rollDegrees: 0,
  }
  const source = { width: 1600, height: 2000 }
  const target = { width: 400, height: 500 }

  it("frames the clinical standard: 이마~턱 52%, 헤어라인 24% → 턱 76%", () => {
    const crop = createAutoCrop({
      framing: FRAMING_PRESETS.clinicalStandard,
      pose: roomyPose,
      source,
      target,
      view: "front",
    })
    expect(crop.scale).toBeCloseTo(0.65, 4)
    const forehead = projectPointToTarget(crop, { x: 800, y: 0.4 * source.height })
    const chin = projectPointToTarget(crop, { x: 800, y: 0.6 * source.height })
    expect(forehead.y / target.height).toBeCloseTo(0.24, 3)
    expect(chin.y / target.height).toBeCloseTo(0.76, 3)
  })

  it("scales 턱밑 by face width so the head matches the frontal magnification", () => {
    // 고개를 젖힌 뷰는 이마~턱이 원근으로 줄어든다 — 폭(양쪽 뺨)이 기울기에 불변.
    const crop = createAutoCrop({
      framing: FRAMING_PRESETS.clinicalStandard,
      pose: roomyPose,
      source,
      target,
      view: "chinUp",
    })
    // 폭 480px(0.3 × 1600)을 프레임 폭의 faceRatio만큼으로 — 수치는 프리셋을 따른다.
    const { faceRatio } = FRAMING_PRESETS.clinicalStandard.views.chinUp
    expect(crop.scale).toBeCloseTo((faceRatio * target.width) / 480, 4)
    const leftCheek = projectPointToTarget(crop, { x: 0.35 * source.width, y: 1000 })
    const rightCheek = projectPointToTarget(crop, { x: 0.65 * source.width, y: 1000 })
    expect((rightCheek.x - leftCheek.x) / target.width).toBeCloseTo(faceRatio, 3)
  })

  it("keeps the close-up preset on the previous tight framing (헤어라인 10% → 턱 86%)", () => {
    const crop = createAutoCrop({
      framing: FRAMING_PRESETS.closeUp,
      pose: roomyPose,
      source,
      target,
      view: "front",
    })
    expect(crop.scale).toBeCloseTo(0.95, 4)
    const forehead = projectPointToTarget(crop, { x: 800, y: 0.4 * source.height })
    const chin = projectPointToTarget(crop, { x: 800, y: 0.6 * source.height })
    expect(forehead.y / target.height).toBeCloseTo(0.1, 3)
    expect(chin.y / target.height).toBeCloseTo(0.86, 3)
  })
})

describe("clavicle alignment (어깨 실측)", () => {
  // 2026-09-02 소유자 결정: 어깨가 측정되면 쇄골선을 프레임 96%에 정확히 놓는다.
  const source = { width: 1600, height: 2000 }
  const target = { width: 400, height: 500 }
  const withShoulders = (shoulderY: number, visibility = 0.9): PhotoPose => ({
    ...pose,
    bounds: { left: 0.35, top: 0.4, right: 0.65, bottom: 0.6 },
    rollDegrees: 0,
    shoulders: {
      left: { x: 0.65, y: shoulderY },
      right: { x: 0.35, y: shoulderY },
      visibility,
    },
  })
  const clavicleOf = (crop: ReturnType<typeof createAutoCrop>, shoulderY: number) =>
    projectPointToTarget(crop, { x: 800, y: shoulderY * source.height }).y / target.height

  it("puts the measured clavicle line at 96% and fits the estimated vertex under the top margin", () => {
    // 긴 목: 얼굴 규칙(0.65)으로는 정수리~쇄골이 안 들어가 배율이 줄어든다.
    const crop = createAutoCrop({
      framing: FRAMING_PRESETS.clinicalStandard,
      pose: withShoulders(0.72),
      source,
      target,
      view: "front",
    })
    expect(crop.scale).toBeCloseTo(0.5718, 3)
    expect(clavicleOf(crop, 0.72)).toBeCloseTo(0.96, 3)
    // 정수리 추정점(이마 − 0.28×얼굴높이)이 정확히 상단 여백 10%에 온다.
    const vertex = projectPointToTarget(crop, { x: 800, y: (0.4 - 0.28 * 0.2) * source.height })
    expect(vertex.y / target.height).toBeCloseTo(0.1, 3)
  })

  it("keeps the face-rule magnification when the span already fits, only shifting to the clavicle", () => {
    const crop = createAutoCrop({
      framing: FRAMING_PRESETS.clinicalStandard,
      pose: withShoulders(0.66),
      source,
      target,
      view: "front",
    })
    expect(crop.scale).toBeCloseTo(0.65, 4)
    expect(clavicleOf(crop, 0.66)).toBeCloseTo(0.96, 3)
  })

  it("falls back to the proportional rule when shoulders are missing or barely visible", () => {
    const proportional = createAutoCrop({
      framing: FRAMING_PRESETS.clinicalStandard,
      pose: { ...withShoulders(0.7), shoulders: undefined },
      source,
      target,
      view: "front",
    })
    const faint = createAutoCrop({
      framing: FRAMING_PRESETS.clinicalStandard,
      pose: withShoulders(0.7, 0.3),
      source,
      target,
      view: "front",
    })
    expect(proportional.targetAnchor).toEqual({ x: 200, y: 250 })
    expect(faint).toEqual(proportional)
  })

  it("never uses shoulders for 정수리 or the close-up preset", () => {
    const crown = createAutoCrop({
      framing: FRAMING_PRESETS.clinicalStandard,
      pose: withShoulders(0.72),
      source,
      target,
      view: "crownDown",
    })
    const closeUp = createAutoCrop({
      framing: FRAMING_PRESETS.closeUp,
      pose: withShoulders(0.72),
      source,
      target,
      view: "front",
    })
    expect(crown.targetAnchor.y).toBeCloseTo(0.56 * 500, 6)
    expect(closeUp.targetAnchor.y).toBeCloseTo(0.48 * 500, 6)
  })
})

describe("mergeCropAdjustment", () => {
  it("adds manual pan and rotation without mutating the automatic crop", () => {
    // Given: a known automatic crop and a normalized user adjustment.
    const automatic = createAutoCrop({
      framing: FRAMING_PRESETS.closeUp,
      pose,
      source: { width: 800, height: 1000 },
      target: { width: 400, height: 500 },
      view: "front",
    })

    // When: the adjustment is applied.
    const adjusted = mergeCropAdjustment(automatic, {
      panX: 0.1,
      panY: -0.05,
      rotationDegrees: 2,
      scaleMultiplier: 1.1,
    })

    // Then: the new instruction changes only the derived values. 세로 +는 얼굴이 위로 —
    // 화면 좌표는 아래가 +이므로 panY −0.05는 앵커를 25px 아래로 보낸다(2026-09-03 부호 규약).
    expect(adjusted.targetAnchor).toEqual({ x: 240, y: 265 })
    expect(adjusted.rotationDegrees).toBe(-6)
    expect(adjusted.scale).toBeCloseTo(automatic.scale * 1.1, 4)
    expect(automatic.targetAnchor).toEqual({ x: 200, y: 240 })
  })
})

describe("createAutoCrop scale invariance", () => {
  it("keeps the same framing when the source is a downscaled display copy", () => {
    // Given: the same normalized pose over an original and a 1/4 display copy.
    const pose = {
      anchor: { x: 0.52, y: 0.45 },
      bounds: { bottom: 0.72, left: 0.28, right: 0.74, top: 0.18 },
      confidence: 0.9,
      id: photoId("scale-invariance"),
      pitchScore: 0.5,
      rollDegrees: 3,
      yawScore: 0.1,
    }
    const target = { width: 800, height: 1000 }
    const original = createAutoCrop({
      framing: FRAMING_PRESETS.closeUp,
      pose,
      source: { width: 3200, height: 4000 },
      target,
      view: "front",
    })
    const displayCopy = createAutoCrop({
      framing: FRAMING_PRESETS.closeUp,
      pose,
      source: { width: 800, height: 1000 },
      target,
      view: "front",
    })

    // Then: anchors scale with the source and the draw scale compensates exactly,
    // so the rendered framing is identical — adjustments stay coordinate-safe.
    expect(original.sourceAnchor.x).toBeCloseTo(displayCopy.sourceAnchor.x * 4, 6)
    expect(original.sourceAnchor.y).toBeCloseTo(displayCopy.sourceAnchor.y * 4, 6)
    expect(original.scale).toBeCloseTo(displayCopy.scale / 4, 6)
    expect(original.targetAnchor).toEqual(displayCopy.targetAnchor)
    expect(original.rotationDegrees).toBe(displayCopy.rotationDegrees)

    const adjustment = { panX: 0.08, panY: -0.04, rotationDegrees: 1.5, scaleMultiplier: 1.1 }
    const adjustedOriginal = mergeCropAdjustment(original, adjustment)
    const adjustedCopy = mergeCropAdjustment(displayCopy, adjustment)
    expect(adjustedOriginal.scale).toBeCloseTo(adjustedCopy.scale / 4, 6)
    expect(adjustedOriginal.targetAnchor).toEqual(adjustedCopy.targetAnchor)
    expect(adjustedOriginal.rotationDegrees).toBe(adjustedCopy.rotationDegrees)
  })
})

describe("createContainCrop", () => {
  it("fits the whole source into the target without rotation, centered on both anchors", () => {
    const crop = createContainCrop({ width: 800, height: 1000 }, { width: 400, height: 500 })

    expect(crop.rotationDegrees).toBe(0)
    expect(crop.scale).toBeCloseTo(0.5, 6)
    expect(crop.sourceAnchor).toEqual({ x: 400, y: 500 })
    expect(crop.targetAnchor).toEqual({ x: 200, y: 250 })
  })

  it("uses the tighter axis so a wide source letterboxes instead of cropping", () => {
    const crop = createContainCrop({ width: 2000, height: 500 }, { width: 400, height: 500 })

    expect(crop.scale).toBeCloseTo(0.2, 6)
  })
})
