import type { PhotoPose, ViewId } from "./types"
import { VIEW_LABELS } from "./workspace"

export type ReviewDiagnostic = {
  readonly blocking: false
  readonly dismissible: true
  readonly kind: "roll"
  readonly message: string
}

// 판정 자는 하나만 둔다(2026-09-01 단일화): yaw·pitch 타당성은 배치 단계의
// 각도 거부권(view-plausibility, 실측 기반)이 판정한다. 종전에는 이 모듈이
// 폐기된 절대 기대표(45도 yaw 0.18, 측면 0.36, pitch 0.5 일괄)로 같은 축을
// 재심사해, 완벽한 합성 세트의 5/7 뷰에 "재촬영 권장"을 붙였다(실측: 45도
// yaw 0.436, 측면 1.027, pitch 0.36대). 남긴 것은 roll(수평 기울기)뿐이다 —
// 카메라·구도와 무관한 절대량이고, 회전 보정·재촬영 판단에 실제로 쓸모가 있다.
const ROLL_REVIEW_DEGREES = 5

export function reviewDiagnostics(view: ViewId, pose: PhotoPose): readonly ReviewDiagnostic[] {
  if (Math.abs(pose.rollDegrees) <= ROLL_REVIEW_DEGREES) {
    return []
  }
  return [
    {
      blocking: false,
      dismissible: true,
      kind: "roll",
      message: `${VIEW_LABELS[view]}: 수평이 기울어져 있습니다. 회전 보정을 확인하거나 재촬영을 권장합니다.`,
    },
  ]
}

export function reviewDiagnosticViewIds(
  photos: readonly { readonly pose: PhotoPose; readonly view: ViewId }[],
  dismissedDiagnosticKeys: readonly string[],
): readonly ViewId[] {
  return photos.flatMap((photo) => {
    const hasVisibleDiagnostic = reviewDiagnostics(photo.view, photo.pose).some(
      (diagnostic) => !dismissedDiagnosticKeys.includes(`${photo.view}:${diagnostic.kind}`),
    )
    return hasVisibleDiagnostic ? [photo.view] : []
  })
}
