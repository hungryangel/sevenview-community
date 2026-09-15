import type { PhotoPose, ViewId } from "./types"

// 자동 배치의 절대 거부권(2026-09-01 도입).
//
// 상대 서열만으로는 "세트에서 가장 오른쪽을 향한 사진"이 정면이어도 우측면 라벨을
// 받는다(실측 재현: 정면 2장 + 우측 45도 1장 세트에서 정면이 좌측 측면·자동 81%로
// 승격되고 정면 슬롯은 비었다). 거부권 하한은 실측 대역 사이의 여유 지대에 둔다:
//  - 정면대 yaw 노이즈: 평상 ±0.05, 극단 pitch 사진에서 ±0.15
//  - 합성 7종 실측: 45도 |yaw| = 0.436, 측면 |yaw| = 0.95~1.03, 정면대 |yaw| ≤ 0.02
//  - 재생성 실사 측면은 45도 대역까지 내려와 측면↔45도는 절대값으로 못 가른다
//    → 측향(측면·45도) 공통 하한 하나만 두고, 같은 쪽에 후보가 둘 이상일 때의
//    측면/45도 구분은 상대 서열(더 극단 = 측면)이 맡는다. 같은 쪽 후보가 하나뿐이면
//    확신 대역(0.7) 미만은 덜 극단적인 45도로 낮춰 부른다.
//  - 턱밑/정수리 pitch는 카메라·촬영마다 절대값이 달라 세트 중앙값 대비 이탈로만
//    본다(합성 이탈 0.27~0.33, 정면대끼리의 산포 ≈ 0.02).
export const LATERAL_MIN_ABS_YAW = 0.18
export const CONFIDENT_PROFILE_MIN_ABS_YAW = 0.7
export const TRIO_MIN_PITCH_DELTA = 0.12

export function isLateralCandidate(pose: PhotoPose, direction: 1 | -1): boolean {
  return pose.yawScore * direction >= LATERAL_MIN_ABS_YAW
}

export function isFrontalBand(pose: PhotoPose): boolean {
  return Math.abs(pose.yawScore) < LATERAL_MIN_ABS_YAW
}

export function isConfidentProfile(pose: PhotoPose): boolean {
  return Math.abs(pose.yawScore) >= CONFIDENT_PROFILE_MIN_ABS_YAW
}

// pitchScore = (코끝y − 눈중심y) / (턱y − 눈중심y). 고개를 뒤로 젖히면(턱 밑 뷰)
// 코끝이 눈 쪽으로 올라가 값이 작아지고, 숙이면(정수리 뷰) 턱 쪽으로 내려가 커진다.
// 2026-09-01 실사진 프로브로 실증(과거에는 반대로 매핑돼 턱밑/정수리가 뒤바뀌었다).
export function chinUpQualifies(pitchScore: number, pitchMedian: number): boolean {
  return pitchMedian - pitchScore >= TRIO_MIN_PITCH_DELTA
}

export function crownDownQualifies(pitchScore: number, pitchMedian: number): boolean {
  return pitchScore - pitchMedian >= TRIO_MIN_PITCH_DELTA
}

// 같은 자세의 반복(같은 파일 재투입)은 다른 각도가 아니다. 같은 파일은 랜드마크가
// 그대로 나와 yaw·pitch 차이가 0이고, 실사에서 측면↔45도의 yaw 차는 0.05까지
// 좁아진다(노이즈 내성 픽스처: 측면 0.33 vs 45도 0.28) — 그래서 문턱은 그보다
// 훨씬 작게(0.02) 두고 yaw·pitch 둘 다 붙어 있을 때만 한 자세로 본다. 2위를 45도로
// 승격하면 세트에 없는 각도를 만들어내는 셈이다(2026-09-02 실측: 같은 사진을
// 여러 장 넣었을 때 측면 복제본이 우측 45도 · 자동으로 앉았다).
export const SAME_POSE_MAX_GAP = 0.02

export function isDistinctLateralPose(reference: PhotoPose, candidate: PhotoPose): boolean {
  return (
    Math.abs(reference.yawScore - candidate.yawScore) >= SAME_POSE_MAX_GAP ||
    Math.abs(reference.pitchScore - candidate.pitchScore) >= SAME_POSE_MAX_GAP
  )
}

export function setPitchMedian(pitches: readonly number[]): number {
  const sorted = pitches.toSorted((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0.5
}

// 실측 랜드마크가 있는 사진만으로 중앙값을 잡는다 — 실패 복구용 수동 배치
// 사진은 중립값(0.5)이 박힌 가짜 포즈라 판정 기준을 오염시킨다.
export function measuredPitchMedian(poses: readonly PhotoPose[]): number {
  return setPitchMedian(
    poses.filter((pose) => pose.eyeCenter !== undefined).map((pose) => pose.pitchScore),
  )
}

// 정면 판정의 상하 허용 — 트리오 하한(0.12)보다 느슨하게 잡아, 약간 든/숙인
// 정면을 오경보하지 않으면서 명백한 턱밑·정수리 사진(이탈 0.27~0.33)만 잡는다.
export const FRONT_MAX_PITCH_DELTA = 0.18

export type PoseMismatch =
  | { readonly kind: "not_lateral" }
  | { readonly kind: "wrong_side" }
  | { readonly kind: "not_frontal" }
  | { readonly kind: "pitch_shallow" }
  | { readonly kind: "pitch_opposite" }
  | { readonly kind: "pitch_extreme" }

// 수동 배치 감시(2026-09-02 bee 지적): 자동 배치의 거부권과 같은 실측 게이트로
// "이 사진이 그 뷰일 수 있는가"를 검사한다. 막지 않고 경고만 한다 — 최종 판단은
// 사람. 랜드마크 없는 사진(실패 복구 수동 배치)은 측정이 없으므로 판정하지 않는다.
export function detectViewPoseMismatch(
  view: ViewId,
  pose: PhotoPose,
  pitchMedian: number,
): PoseMismatch | null {
  if (pose.eyeCenter === undefined) {
    return null
  }
  switch (view) {
    case "rightProfile":
    case "rightOblique":
      if (Math.abs(pose.yawScore) < LATERAL_MIN_ABS_YAW) {
        return { kind: "not_lateral" }
      }
      return pose.yawScore < 0 ? { kind: "wrong_side" } : null
    case "leftProfile":
    case "leftOblique":
      if (Math.abs(pose.yawScore) < LATERAL_MIN_ABS_YAW) {
        return { kind: "not_lateral" }
      }
      return pose.yawScore > 0 ? { kind: "wrong_side" } : null
    case "front":
    case "frontSmile":
      if (Math.abs(pose.yawScore) >= LATERAL_MIN_ABS_YAW) {
        return { kind: "not_frontal" }
      }
      return Math.abs(pose.pitchScore - pitchMedian) >= FRONT_MAX_PITCH_DELTA
        ? { kind: "pitch_extreme" }
        : null
    case "chinUp":
      if (Math.abs(pose.yawScore) >= LATERAL_MIN_ABS_YAW) {
        return { kind: "not_frontal" }
      }
      if (pose.pitchScore - pitchMedian >= TRIO_MIN_PITCH_DELTA) {
        return { kind: "pitch_opposite" }
      }
      return chinUpQualifies(pose.pitchScore, pitchMedian) ? null : { kind: "pitch_shallow" }
    case "crownDown":
      if (Math.abs(pose.yawScore) >= LATERAL_MIN_ABS_YAW) {
        return { kind: "not_frontal" }
      }
      if (pitchMedian - pose.pitchScore >= TRIO_MIN_PITCH_DELTA) {
        return { kind: "pitch_opposite" }
      }
      return crownDownQualifies(pose.pitchScore, pitchMedian) ? null : { kind: "pitch_shallow" }
  }
}

// 측정값이 가리키는 가장 그럴듯한 뷰 — 배치 규칙과 같은 대역을 쓴다
// (확신 측면 ≥0.7, 측향 ≥0.18은 45도로 낮춰 부름).
export function suggestViewForPose(pose: PhotoPose, pitchMedian: number): ViewId {
  if (pose.yawScore >= CONFIDENT_PROFILE_MIN_ABS_YAW) {
    return "rightProfile"
  }
  if (pose.yawScore <= -CONFIDENT_PROFILE_MIN_ABS_YAW) {
    return "leftProfile"
  }
  if (pose.yawScore >= LATERAL_MIN_ABS_YAW) {
    return "rightOblique"
  }
  if (pose.yawScore <= -LATERAL_MIN_ABS_YAW) {
    return "leftOblique"
  }
  if (chinUpQualifies(pose.pitchScore, pitchMedian)) {
    return "chinUp"
  }
  if (crownDownQualifies(pose.pitchScore, pitchMedian)) {
    return "crownDown"
  }
  return "front"
}
