import { createContainCrop } from "../domain/crop"
import { projectPointToTarget } from "../domain/render-plan"
import type { Point } from "../domain/types"
import { COMPARISON_PREVIEW_SIZE, type ComparisonRenderModel } from "./comparison-render-model"
import type { ExplicitPresentationItem } from "./completion-presentation-frame"

type ReadyModel = Extract<ComparisonRenderModel, { readonly kind: "ready" }>

export function comparisonPresentationItems(
  model: ReadyModel,
): readonly ExplicitPresentationItem[] {
  return (["before", "after"] as const).map((side) => {
    const render = model[side]
    const originalInstruction = createContainCrop(render.slot.decoded, COMPARISON_PREVIEW_SIZE)
    const anchors = render.slot.kind === "ready" ? render.slot.pose.registrationAnchors : undefined
    const sourcePoints: readonly Point[] =
      anchors === undefined
        ? [render.references.first, render.references.second]
        : [anchors.screenLeftEye, anchors.screenRightEye, anchors.noseTip].map((point) => ({
            x: point.x * render.slot.decoded.width,
            y: point.y * render.slot.decoded.height,
          }))
    const normalizedPoints = sourcePoints.map((point) => {
      const projected = projectPointToTarget(originalInstruction, point)
      return {
        x: projected.x / COMPARISON_PREVIEW_SIZE.width,
        y: projected.y / COMPARISON_PREVIEW_SIZE.height,
      }
    })
    return {
      alignedInstruction: render.instruction,
      id: `${render.slot.kind === "ready" ? render.slot.pose.id : "manual"}-${side}`,
      image: render.slot.decoded.image,
      normalizedPoints,
      originalInstruction,
    }
  })
}
