import type { ViewId } from "./types"

// 감지 신뢰도(볼 폭×얼굴 높이 비율)는 "이 뷰일 확률"이 아니라 얼굴 기준점이
// 얼마나 뚜렷하게 잡혔는지다. 분석 시점에 한 번 계산되는 상수라 보정으로 변하지
// 않고, 기하 구조상 고개를 돌릴수록(볼 폭이 좁아질수록) 낮게 나온다.
//
// 2026-09-01 합성 7종 실측: 정면 0.810 · 45도 0.645/0.660 · 측면 0.252/0.362 ·
// 턱밑 0.694 · 정수리 0.536. 종전의 단일 임계값(0.7)은 완벽한 세트에서도 6/7 뷰에
// "검토 필요"를 붙이는 양치기 경고였다. 뷰별 기대값 대비 비율로만 판정한다.
export const EXPECTED_DETECTION_CONFIDENCE: Record<ViewId, number> = {
  front: 0.8,
  frontSmile: 0.8,
  rightOblique: 0.65,
  leftOblique: 0.65,
  rightProfile: 0.25,
  leftProfile: 0.25,
  chinUp: 0.7,
  crownDown: 0.55,
}

const CLEAR_RATIO = 0.8
const WEAK_RATIO = 0.5

export type DetectionQuality = "clear" | "fair" | "weak"

export const DETECTION_QUALITY_LABELS: Record<DetectionQuality, string> = {
  clear: "뚜렷함",
  fair: "보통",
  weak: "흐림",
}

export function detectionQuality(view: ViewId, confidence: number): DetectionQuality {
  const ratio = confidence / EXPECTED_DETECTION_CONFIDENCE[view]
  if (ratio >= CLEAR_RATIO) {
    return "clear"
  }
  return ratio >= WEAK_RATIO ? "fair" : "weak"
}

export function isDetectionWeak(view: ViewId, confidence: number): boolean {
  return detectionQuality(view, confidence) === "weak"
}
