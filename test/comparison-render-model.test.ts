import { describe, expect, it } from "vitest"

import { photoId } from "../src/domain/types"
import { comparisonPresentationItems } from "../src/product/comparison-presentation-items"
import {
  buildComparisonRenderModel,
  EMPTY_COMPARISON_ADJUSTMENT,
  scaleComparisonInstruction,
} from "../src/product/comparison-render-model"

const image = {} as CanvasImageSource
const anchors = {
  noseTip: { x: 0.5, y: 0.52 },
  screenLeftEye: { x: 0.35, y: 0.4 },
  screenRightEye: { x: 0.65, y: 0.4 },
}
const pose = {
  anchor: { x: 0.5, y: 0.5 },
  bounds: { bottom: 0.8, left: 0.2, right: 0.8, top: 0.2 },
  confidence: 0.9,
  id: photoId("render-model"),
  pitchScore: 0,
  registrationAnchors: anchors,
  rollDegrees: 0,
  yawScore: 0,
}
const slot = {
  decoded: { height: 1000, image, width: 800 },
  file: new File(["fixture"], "coordinate-fixture.png"),
  kind: "ready" as const,
  pose,
}

describe("comparison render model", () => {
  it("uses one immutable instruction set for preview and proportional export", () => {
    const model = buildComparisonRenderModel({
      angle: "front",
      manualReferences: {},
      pair: { after: slot, before: slot },
      residual: EMPTY_COMPARISON_ADJUSTMENT,
      revision: 4,
    })
    expect(model.kind).toBe("ready")
    if (model.kind !== "ready") return
    const exported = scaleComparisonInstruction(model.after.instruction, {
      height: 940,
      width: 752,
    })
    expect(exported.scale / model.after.instruction.scale).toBeCloseTo(1.88)
    expect(exported.targetAnchor.x / model.after.instruction.targetAnchor.x).toBeCloseTo(1.88)
    expect(model.after.preResidualErrorPixels).toBeLessThanOrEqual(0.5)
    expect(model.revision).toBe(4)
    const presentation = comparisonPresentationItems(model)
    expect(presentation[1]?.alignedInstruction).toBe(model.after.instruction)
    expect(presentation[1]?.originalInstruction).toMatchObject({
      rotationDegrees: 0,
      targetSize: { height: 500, width: 400 },
    })
    expect(presentation[1]?.normalizedPoints).toHaveLength(3)
  })

  it("requires real or manual points and rejects invalid residual scale", () => {
    const { registrationAnchors: _anchors, ...poseWithoutAnchors } = pose
    const missing = { ...slot, pose: poseWithoutAnchors }
    expect(
      buildComparisonRenderModel({
        angle: "front",
        manualReferences: {},
        pair: { after: missing, before: slot },
        residual: EMPTY_COMPARISON_ADJUSTMENT,
        revision: 1,
      }),
    ).toMatchObject({ kind: "reviewRequired", reason: "missing_landmarks", side: "after" })
    expect(
      buildComparisonRenderModel({
        angle: "front",
        manualReferences: {},
        pair: { after: slot, before: slot },
        residual: { ...EMPTY_COMPARISON_ADJUSTMENT, scaleMultiplier: 0 },
        revision: 2,
      }),
    ).toMatchObject({ kind: "reviewRequired", side: "after" })
  })

  it("recomputes neutral margin from the final residual instruction", () => {
    const centered = buildComparisonRenderModel({
      angle: "front",
      manualReferences: {},
      pair: { after: slot, before: slot },
      residual: EMPTY_COMPARISON_ADJUSTMENT,
      revision: 1,
    })
    const panned = buildComparisonRenderModel({
      angle: "front",
      manualReferences: {},
      pair: { after: slot, before: slot },
      residual: { ...EMPTY_COMPARISON_ADJUSTMENT, panX: 0.8 },
      revision: 2,
    })
    expect(centered.kind).toBe("ready")
    expect(panned.kind).toBe("ready")
    if (centered.kind === "ready" && panned.kind === "ready") {
      expect(centered.after.neutralMargin).toBe(false)
      expect(panned.after.neutralMargin).toBe(true)
      expect(panned.after.postResidualDisplacementPixels).toBeGreaterThan(0)
    }
  })
})
