import type { CropInstruction, ImageSize, Point } from "./types"

export type RenderPlan = {
  readonly targetSize: ImageSize
  readonly translateTo: Point
  readonly rotationRadians: number
  readonly scale: number
  readonly translateSource: Point
}

// 이미지 좌표(px)의 한 점이 크롭 결과(target px)에서 어디에 떨어지는지 계산한다.
// drawCroppedImage의 변환(translate→rotate→scale→translate)과 같은 식이다 —
// 눈높이 기준선처럼 오버레이를 실제 위치에 그릴 때 쓴다.
export function projectPointToTarget(crop: CropInstruction, imagePoint: Point): Point {
  const radians = (crop.rotationDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = (imagePoint.x - crop.sourceAnchor.x) * crop.scale
  const dy = (imagePoint.y - crop.sourceAnchor.y) * crop.scale
  return {
    x: cos * dx - sin * dy + crop.targetAnchor.x,
    y: sin * dx + cos * dy + crop.targetAnchor.y,
  }
}

export function buildRenderPlan(crop: CropInstruction): RenderPlan {
  return {
    targetSize: crop.targetSize,
    translateTo: crop.targetAnchor,
    rotationRadians: (crop.rotationDegrees * Math.PI) / 180,
    scale: crop.scale,
    translateSource: {
      x: -crop.sourceAnchor.x,
      y: -crop.sourceAnchor.y,
    },
  }
}
