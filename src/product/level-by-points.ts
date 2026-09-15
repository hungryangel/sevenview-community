import type { Point } from "../domain/types"

// 기준선 2점 수평 보조(2026-09-03): 사진 위에서 두 점(예: 이주 상단과 눈확 아랫점 = FH 평면)을
// 찍으면 그 선이 수평이 되도록 수동 회전값을 정한다. 자동 판정이 아니라 사람이 찍은 점을
// 그대로 따르는 보조 도구다. 회전 범위(±12°)를 넘으면 잘라내고 알려준다.
export const LEVEL_ROTATION_LIMIT_DEGREES = 12

export function angleBetweenPoints(from: Point, to: Point): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
}

export type LevelResult = {
  readonly clipped: boolean
  readonly rotationDegrees: number
}

// 미리보기(회전이 이미 적용된 좌표계)에서 찍은 두 점의 기울기만큼 더 돌리면 수평이 된다.
export function rotationToLevel(
  currentRotationDegrees: number,
  from: Point,
  to: Point,
  limit = LEVEL_ROTATION_LIMIT_DEGREES,
): LevelResult {
  const target = currentRotationDegrees - angleBetweenPoints(from, to)
  const rounded = Math.round(target * 10) / 10
  const rotationDegrees = Math.min(limit, Math.max(-limit, rounded))
  return { clipped: rotationDegrees !== rounded, rotationDegrees }
}
