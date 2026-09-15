import { z } from "zod"

// 뷰의 전체 목록(정본 식별자). 어떤 뷰를 몇 개 쓰는지는 view-set.ts의 세트가 정한다.
export const VIEW_IDS = [
  "front",
  "frontSmile",
  "rightOblique",
  "leftOblique",
  "rightProfile",
  "leftProfile",
  "chinUp",
  "crownDown",
] as const

export type ViewId = (typeof VIEW_IDS)[number]

// 성형외과 표준 7뷰(초안) — SevenViewAssignment처럼 7뷰를 고정 전제로 하는 옛 경로용.
export const CLASSIC_SEVEN_VIEW_IDS = [
  "front",
  "rightOblique",
  "leftOblique",
  "rightProfile",
  "leftProfile",
  "chinUp",
  "crownDown",
] as const satisfies readonly ViewId[]

export type ClassicSevenViewId = (typeof CLASSIC_SEVEN_VIEW_IDS)[number]

export const ANALYSIS_FAILURE_CODES = [
  "face_not_detected",
  "decode_failed",
  "analysis_failed",
] as const

export type AnalysisFailureCode = (typeof ANALYSIS_FAILURE_CODES)[number]

const PhotoIdSchema = z.string().min(1).brand("PhotoId")

export type PhotoId = z.infer<typeof PhotoIdSchema>

export function photoId(value: string): PhotoId {
  return PhotoIdSchema.parse(value)
}

export type Point = {
  readonly x: number
  readonly y: number
}

export type Rect = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export type ImageSize = {
  readonly width: number
  readonly height: number
}

export type FaceAnchors = {
  readonly leftEye: Point
  readonly rightEye: Point
  readonly noseTip: Point
  readonly forehead: Point
  readonly chin: Point
  readonly leftCheek: Point
  readonly rightCheek: Point
  // 입꼬리 두 점과 윗입술 아래·아랫입술 위(입 벌림). 스마일 판별에 쓴다.
  readonly mouthLeft: Point
  readonly mouthRight: Point
  readonly upperLipInner: Point
  readonly lowerLipInner: Point
  // 얼굴 메시 전체의 가로 범위(정규화 x). 측면 사진에서는 양쪽 뺨이 깊이만 다르고
  // 화면 x는 거의 같아 뺨 중점이 귀 쪽으로 몰린다 — 가로 중심은 이 범위로 잡는다.
  readonly outline: { readonly left: number; readonly right: number }
}

// 어깨 랜드마크(정규화 이미지 좌표, 환자 기준 좌/우). 포즈 모델이 어깨를 못 보면
// (원본이 목에서 잘림 등) 없다 — 그 경우 쇄골선은 얼굴 비율로 추정한다.
export type ShoulderAnchors = {
  readonly left: Point
  readonly right: Point
  // 두 어깨 가시성 중 낮은 값(0~1).
  readonly visibility: number
}

export type FaceMetrics = {
  readonly detectionMethod?: "profile_recovery"
  readonly yawScore: number
  readonly pitchScore: number
  readonly rollDegrees: number
  readonly confidence: number
  readonly bounds: Rect
  readonly anchor: Point
  // 양안 중점(정규화 이미지 좌표). 눈높이 기준선 표시에 쓴다. 랜드마크 없이 만든
  // 포즈(수동 배치)는 없을 수 있고, 그 경우 기준선을 그리지 않는다.
  readonly eyeCenter?: Point
  readonly registrationAnchors?: RegistrationAnchors
  // 검출 원본 좌표는 현재 세션 메모리에만 보관한다. 저장·이벤트 전송용 자료가 아니다.
  readonly landmarkGeometry?: FaceLandmarkGeometry
  // 어깨 실측(포즈 모델). 쇄골선 정렬에 쓴다.
  readonly shoulders?: ShoulderAnchors | undefined
  // 스마일 점수 = 입 폭/뺨 폭 + 입 벌림/얼굴 높이. 절대 문턱이 아니라 같은 세트 안의
  // 정면 사진끼리 비교하는 용도(무표정 vs 스마일). 랜드마크 없는 포즈에는 없다.
  readonly smileScore?: number
}

export type FaceLandmarkGeometry = {
  readonly points: readonly Point[]
  readonly named: {
    readonly forehead: Point
    readonly chin: Point
    readonly screenLeftCheek: Point
    readonly screenRightCheek: Point
    readonly noseTip: Point
    readonly noseBridgeUpper: Point
    readonly noseBridgeLower: Point
    readonly screenLeftEyeOuter: Point
    readonly screenLeftEyeInner: Point
    readonly screenLeftEyeUpper: Point
    readonly screenLeftEyeLower: Point
    readonly screenRightEyeOuter: Point
    readonly screenRightEyeInner: Point
    readonly screenRightEyeUpper: Point
    readonly screenRightEyeLower: Point
  }
}

export type FaceLandmarkName = keyof FaceLandmarkGeometry["named"]

export type RegistrationAnchors = {
  readonly screenLeftEye: Point
  readonly screenRightEye: Point
  readonly noseTip: Point
}

export type PhotoPose = FaceMetrics & {
  readonly id: PhotoId
}

export type SevenViewAssignment = {
  readonly front: PhotoId
  readonly rightOblique: PhotoId
  readonly leftOblique: PhotoId
  readonly rightProfile: PhotoId
  readonly leftProfile: PhotoId
  readonly chinUp: PhotoId
  readonly crownDown: PhotoId
}

export type CropInstruction = {
  readonly sourceAnchor: Point
  readonly targetAnchor: Point
  readonly targetSize: ImageSize
  readonly scale: number
  readonly rotationDegrees: number
}

export type CropAdjustment = {
  readonly panX: number
  readonly panY: number
  readonly rotationDegrees: number
  readonly scaleMultiplier: number
}
