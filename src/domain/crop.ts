import { clavicleLine } from "./body-anchors"
import type { FramingPreset, ViewFraming } from "./protocol-preset"
import type { CropAdjustment, CropInstruction, ImageSize, PhotoPose, Point, ViewId } from "./types"

type AutoCropInput = {
  readonly framing: FramingPreset
  readonly pose: PhotoPose
  readonly source: ImageSize
  readonly target: ImageSize
  readonly view: ViewId
}

export type ProfileCropInput = {
  readonly pose: PhotoPose
  readonly profile: Pick<ViewFraming, "faceExtent" | "faceRatio" | "targetAnchor">
  readonly source: ImageSize
  readonly target: ImageSize
}

export type ProfileCropResult = {
  readonly coverScale: number
  readonly desiredFaceScale: number
  readonly instruction: CropInstruction
}

function scaleForSourceAxisCoverage(
  sourceAnchor: number,
  sourceSize: number,
  projectedTargetOffset: number,
): number {
  if (projectedTargetOffset > 0) {
    return projectedTargetOffset / Math.max(1, sourceSize - sourceAnchor)
  }

  if (projectedTargetOffset < 0) {
    return -projectedTargetOffset / Math.max(1, sourceAnchor)
  }

  return 0
}

function minimumScaleToCoverTarget(
  source: ImageSize,
  target: ImageSize,
  sourceAnchor: Point,
  targetAnchor: Point,
  rotationDegrees: number,
): number {
  const rotationRadians = (rotationDegrees * Math.PI) / 180
  const cos = Math.cos(rotationRadians)
  const sin = Math.sin(rotationRadians)
  const targetCorners = [
    { x: 0, y: 0 },
    { x: target.width, y: 0 },
    { x: 0, y: target.height },
    { x: target.width, y: target.height },
  ]

  return targetCorners.reduce((minimumScale, corner) => {
    const targetOffsetX = corner.x - targetAnchor.x
    const targetOffsetY = corner.y - targetAnchor.y
    const sourceOffsetX = cos * targetOffsetX + sin * targetOffsetY
    const sourceOffsetY = -sin * targetOffsetX + cos * targetOffsetY

    return Math.max(
      minimumScale,
      scaleForSourceAxisCoverage(sourceAnchor.x, source.width, sourceOffsetX),
      scaleForSourceAxisCoverage(sourceAnchor.y, source.height, sourceOffsetY),
    )
  }, 0)
}

export function createAutoCrop(input: AutoCropInput): CropInstruction {
  const profile = input.framing.views[input.view]
  const proportional = createProfileCrop({
    pose: input.pose,
    profile,
    source: input.source,
    target: input.target,
  })
  const { desiredFaceScale: faceScale } = proportional
  const { sourceAnchor, targetAnchor } = proportional.instruction

  const aligned = alignToClavicle(input, profile, faceScale, sourceAnchor, targetAnchor)
  if (aligned !== null) {
    return {
      sourceAnchor,
      targetAnchor: aligned.targetAnchor,
      targetSize: input.target,
      scale: aligned.scale,
      rotationDegrees: proportional.instruction.rotationDegrees,
    }
  }

  return proportional.instruction
}

export function createProfileCrop(input: ProfileCropInput): ProfileCropResult {
  const profile = input.profile
  const faceExtentPixels =
    profile.faceExtent === "height"
      ? Math.abs(input.pose.bounds.bottom - input.pose.bounds.top) * input.source.height
      : Math.abs(input.pose.bounds.right - input.pose.bounds.left) * input.source.width
  const targetExtent = profile.faceExtent === "height" ? input.target.height : input.target.width
  const safeFaceExtent = Math.max(1, faceExtentPixels)
  const sourceAnchor = {
    x: input.pose.anchor.x * input.source.width,
    y: input.pose.anchor.y * input.source.height,
  }
  const targetAnchor = {
    x: profile.targetAnchor.x * input.target.width,
    y: profile.targetAnchor.y * input.target.height,
  }
  const rotationDegrees = -input.pose.rollDegrees
  const faceScale = (profile.faceRatio * targetExtent) / safeFaceExtent
  const coverScale = minimumScaleToCoverTarget(
    input.source,
    input.target,
    sourceAnchor,
    targetAnchor,
    rotationDegrees,
  )

  return {
    coverScale,
    desiredFaceScale: faceScale,
    instruction: {
      sourceAnchor,
      targetAnchor,
      targetSize: input.target,
      scale: Math.max(faceScale, coverScale),
      rotationDegrees,
    },
  }
}

// 쇄골선 실측 정렬: 어깨가 측정된 사진은 쇄골선을 규약 위치(bottom)에 정확히 놓는다.
// 배율은 얼굴 규칙과 "정수리 추정점~쇄골선이 프레임에 들어오는 배율" 중 작은 쪽.
// 원본이 그 범위를 담지 못하면(커버 하한 초과) null — 호출측이 비율 규칙으로 물러난다.
function alignToClavicle(
  input: AutoCropInput,
  profile: ViewFraming,
  faceScale: number,
  sourceAnchor: Point,
  fallbackAnchor: Point,
): { readonly scale: number; readonly targetAnchor: Point } | null {
  const rule = profile.clavicle
  const clavicle = rule === undefined ? null : clavicleLine(input.pose)
  if (rule === undefined || clavicle === null) {
    return null
  }
  const faceHeight = Math.abs(input.pose.bounds.bottom - input.pose.bounds.top)
  const vertexY = (input.pose.bounds.top - rule.vertexAllowance * faceHeight) * input.source.height
  const clavicleY = clavicle.y * input.source.height
  const span = clavicleY - vertexY
  if (span <= 0) {
    return null
  }
  const fitScale = ((rule.bottom - rule.topMargin) * input.target.height) / span
  const scale = Math.min(faceScale, fitScale)
  const rotationDegrees = -input.pose.rollDegrees
  const radians = (rotationDegrees * Math.PI) / 180
  const dx = (clavicle.x * input.source.width - sourceAnchor.x) * scale
  const dy = (clavicleY - sourceAnchor.y) * scale
  // projectPointToTarget과 같은 회전 규약: y' = sin·dx + cos·dy + anchor.y
  const targetAnchor = {
    x: fallbackAnchor.x,
    y: rule.bottom * input.target.height - (Math.sin(radians) * dx + Math.cos(radians) * dy),
  }
  const coverScale = minimumScaleToCoverTarget(
    input.source,
    input.target,
    sourceAnchor,
    targetAnchor,
    rotationDegrees,
  )
  return coverScale > scale ? null : { scale, targetAnchor }
}

// 원본 보기용: 회전·보정 없이 원본 전체를 target 안에 contain-fit으로 담는
// 크롭 명령. 정렬본과 같은 렌더 파이프라인을 그대로 태운다.
export function createContainCrop(source: ImageSize, target: ImageSize): CropInstruction {
  return {
    sourceAnchor: { x: source.width / 2, y: source.height / 2 },
    targetAnchor: { x: target.width / 2, y: target.height / 2 },
    targetSize: target,
    scale: Math.min(
      target.width / Math.max(1, source.width),
      target.height / Math.max(1, source.height),
    ),
    rotationDegrees: 0,
  }
}

export function mergeCropAdjustment(
  automatic: CropInstruction,
  adjustment: CropAdjustment,
): CropInstruction {
  return {
    ...automatic,
    // 부호 규약(2026-09-03 bee): 가로 +는 얼굴이 오른쪽으로, 세로 +는 얼굴이 **위로**. 화면 좌표는
    // 아래가 +라서 세로는 빼 준다 — 이전엔 +가 아래로 내려가 사용자 직관과 반대였다.
    targetAnchor: {
      x: automatic.targetAnchor.x + adjustment.panX * automatic.targetSize.width,
      y: automatic.targetAnchor.y - adjustment.panY * automatic.targetSize.height,
    },
    scale: automatic.scale * adjustment.scaleMultiplier,
    rotationDegrees: automatic.rotationDegrees + adjustment.rotationDegrees,
  }
}
