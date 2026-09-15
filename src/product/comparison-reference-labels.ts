import type { ComparisonAngle } from "../domain/comparison"
import type { ComparisonRenderSide } from "./comparison-render-model"

export function comparisonReferenceLabels(
  render: ComparisonRenderSide,
  angle: ComparisonAngle,
): readonly [string, string] {
  if (render.provenance === "manual") return ["기준점 1", "기준점 2"]
  if (angle === "front") return ["화면 왼쪽 눈", "화면 오른쪽 눈"]
  if (render.slot.kind === "ready" && render.slot.pose.landmarkGeometry !== undefined)
    return ["이마 중앙", "콧등 아래"]
  return ["눈 중심", "코끝"]
}
