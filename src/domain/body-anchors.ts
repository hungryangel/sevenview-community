import type { PhotoPose, Point } from "./types"

// 어깨 랜드마크는 원근·가림으로 흔들린다. 두 어깨의 가시성이 이 값 아래면
// 쇄골선을 실측으로 쓰지 않고 얼굴 비율 추정으로 정직하게 물러난다.
export const SHOULDER_MIN_VISIBILITY = 0.5

// 쇄골선 = 두 어깨 랜드마크의 중점(정규화 이미지 좌표). 흉골절흔은 이 선의
// 정중선 위, 어깨 높이와 거의 같거나 조금 아래에 놓인다.
export function clavicleLine(pose: Pick<PhotoPose, "shoulders">): Point | null {
  const shoulders = pose.shoulders
  if (shoulders === undefined || shoulders.visibility < SHOULDER_MIN_VISIBILITY) {
    return null
  }
  return {
    x: (shoulders.left.x + shoulders.right.x) / 2,
    y: (shoulders.left.y + shoulders.right.y) / 2,
  }
}
