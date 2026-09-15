import { describe, expect, it } from "vitest"
import { extractFaceLandmarkGeometry } from "../src/adapters/landmarks"
import { projectPointToTarget } from "../src/domain/render-plan"
import { photoId } from "../src/domain/types"
import { comparisonPhotoInformation } from "../src/product/comparison-photo-information"
import {
  buildComparisonRenderModel,
  EMPTY_COMPARISON_ADJUSTMENT,
} from "../src/product/comparison-render-model"

const image = document.createElement("canvas")
const pair = {
  before: {
    kind: "ready" as const,
    file: new File(["before"], "before.png", { type: "image/png" }),
    decoded: { image, width: 800, height: 1000 },
    pose: {
      anchor: { x: 0.5, y: 0.5 },
      bounds: { bottom: 0.8, left: 0.2, right: 0.8, top: 0.2 },
      confidence: 1,
      id: photoId("before-info"),
      pitchScore: 0,
      registrationAnchors: {
        noseTip: { x: 0.5, y: 0.5 },
        screenLeftEye: { x: 0.35, y: 0.4 },
        screenRightEye: { x: 0.65, y: 0.4 },
      },
      rollDegrees: 0,
      yawScore: 0,
    },
  },
  after: {
    kind: "ready" as const,
    file: new File(["after"], "after.png", { type: "image/png" }),
    decoded: { image, width: 800, height: 1000 },
    pose: {
      anchor: { x: 0.5, y: 0.5 },
      bounds: { bottom: 0.75, left: 0.25, right: 0.75, top: 0.25 },
      confidence: 1,
      id: photoId("after-info"),
      pitchScore: 0,
      registrationAnchors: {
        noseTip: { x: 0.5, y: 0.5 },
        screenLeftEye: { x: 0.35, y: 0.4 },
        screenRightEye: { x: 0.65, y: 0.4 },
      },
      rollDegrees: 0,
      yawScore: 0,
    },
  },
}

function readyModel() {
  const model = buildComparisonRenderModel({
    angle: "front",
    manualReferences: {},
    pair,
    residual: EMPTY_COMPARISON_ADJUSTMENT,
    revision: 1,
  })
  if (model.kind !== "ready") throw new Error("fixture must be ready")
  return model
}

describe("comparisonPhotoInformation", () => {
  it("shows retained mesh points and named forehead/chin through the same crop transform", () => {
    // Given actual detector-style geometry retained in source coordinates.
    const model = readyModel()
    const geometry = extractFaceLandmarkGeometry(
      Array.from({ length: 478 }, (_, index) => ({
        x: 0.3 + index * 0.0004,
        y: 0.4 + index * 0.0002,
        z: 0,
      })),
    )
    const render = {
      ...model.after,
      slot: { ...pair.after, pose: { ...pair.after.pose, landmarkGeometry: geometry } },
    }
    // When the user opts into the complete geometry overlay.
    const information = comparisonPhotoInformation(render, "landmarks", "front")
    // Then points are projected, not guessed or replaced by a bounding box.
    expect(information.kind).toBe("landmarks")
    if (information.kind !== "landmarks") throw new Error("mesh overlay expected")
    expect(information.points).toHaveLength(478)
    expect(information.named.map((point) => point.label)).toEqual(
      expect.arrayContaining(["이마 중앙", "턱끝", "코끝"]),
    )
  })

  it("projects pixel registration references exactly once through the preview instruction", () => {
    const render = readyModel().before
    const information = comparisonPhotoInformation(render, "registration", "front")
    expect(information.kind).toBe("registration")
    if (information.kind !== "registration") return
    expect(information.points[0]?.x).toBeGreaterThan(0)
    expect(information.points[0]?.x).toBeLessThan(1)
    expect(information.points[0]?.label).toBe("화면 왼쪽 눈")
  })

  it("projects all four source-bound corners and rejects invalid source geometry", () => {
    const model = readyModel()
    if (model.after.slot.kind !== "ready") throw new Error("automatic fixture required")
    const information = comparisonPhotoInformation(model.after, "faceRegion", "front")
    expect(information.kind).toBe("faceRegion")
    if (information.kind !== "faceRegion") return
    expect(information.polygon).toHaveLength(4)
    const expectedTopLeft = projectPointToTarget(model.after.instruction, {
      x: model.after.slot.pose.bounds.left * model.after.slot.decoded.width,
      y: model.after.slot.pose.bounds.top * model.after.slot.decoded.height,
    })
    expect(information.polygon[0]).toEqual({
      x: expectedTopLeft.x / model.after.instruction.targetSize.width,
      y: expectedTopLeft.y / model.after.instruction.targetSize.height,
    })

    const invalid = comparisonPhotoInformation(
      {
        ...model.after,
        slot: {
          ...model.after.slot,
          pose: { ...model.after.slot.pose, bounds: { ...model.after.slot.pose.bounds, left: 2 } },
        },
      },
      "faceRegion",
      "front",
    )
    expect(invalid).toEqual({ kind: "unavailable" })
  })

  it("reflects manual source references and the after-photo residual", () => {
    const baseline = readyModel()
    const adjusted = buildComparisonRenderModel({
      angle: "front",
      manualReferences: {
        after: { first: { x: 0.3, y: 0.4 }, second: { x: 0.7, y: 0.4 } },
      },
      pair,
      residual: { ...EMPTY_COMPARISON_ADJUSTMENT, panX: 0.05 },
      revision: 2,
    })
    if (adjusted.kind !== "ready") throw new Error("adjusted fixture must be ready")
    const baselineInformation = comparisonPhotoInformation(baseline.after, "registration", "front")
    const adjustedInformation = comparisonPhotoInformation(adjusted.after, "registration", "front")
    if (
      baselineInformation.kind !== "registration" ||
      adjustedInformation.kind !== "registration"
    ) {
      throw new Error("registration information must be available")
    }
    expect(adjustedInformation.provenance).toBe("manual")
    expect(adjustedInformation.points[0]?.x).not.toBe(baselineInformation.points[0]?.x)
    expect(adjustedInformation.points.map((point) => point.label)).toEqual(["기준점 1", "기준점 2"])
  })
})
// @vitest-environment jsdom
