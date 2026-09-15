import type { CropAdjustment } from "../../src/domain/types"
import { photoId } from "../../src/domain/types"
import {
  buildComparisonRenderModel,
  EMPTY_COMPARISON_ADJUSTMENT,
} from "../../src/product/comparison-render-model"

export function editorModel(residual: CropAdjustment = EMPTY_COMPARISON_ADJUSTMENT) {
  const slot = {
    decoded: { height: 500, image: document.createElement("canvas"), width: 1000 },
    file: new File(["coordinate"], "coordinate.png"),
    kind: "ready" as const,
    pose: {
      anchor: { x: 0.5, y: 0.5 },
      bounds: { bottom: 0.8, left: 0.2, right: 0.8, top: 0.2 },
      confidence: 0.9,
      id: photoId("editor"),
      pitchScore: 0,
      registrationAnchors: {
        noseTip: { x: 0.5, y: 0.52 },
        screenLeftEye: { x: 0.35, y: 0.4 },
        screenRightEye: { x: 0.65, y: 0.4 },
      },
      rollDegrees: 0,
      yawScore: 0,
    },
  }
  const model = buildComparisonRenderModel({
    angle: "front",
    manualReferences: {},
    pair: { after: slot, before: slot },
    residual,
    revision: 1,
  })
  if (model.kind !== "ready") throw new Error("fixture must be ready")
  return model
}

export const previewBounds = {
  bottom: 550,
  height: 500,
  left: 100,
  right: 500,
  top: 50,
  width: 400,
  x: 100,
  y: 50,
  toJSON: () => ({}),
}
