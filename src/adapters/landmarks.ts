import { z } from "zod"
import type { FaceAnchors, FaceLandmarkGeometry, Point, ShoulderAnchors } from "../domain/types"

export type LandmarkPoint = {
  readonly x: number
  readonly y: number
}

// MediaPipe FaceLandmarker의 얼굴 기준점 수(메시 468 + 홍채 10).
// 인스펙터 '정렬 명세'에 근거로 표기한다 — 목업의 "68점"은 다른 모델 얘기다.
export const FACE_LANDMARK_COUNT = 478

const NormalizedMeshSchema = z.array(z.object({ x: z.number().finite(), y: z.number().finite() }))

// Official topology: google-ai-edge/mediapipe, python/solutions/face_mesh_connections.py.
// Screen-side names preserve the established unmirrored anchor convention (33/133 on the left).
export function extractFaceLandmarkGeometry(
  landmarks: readonly LandmarkPoint[],
): FaceLandmarkGeometry {
  const points = Object.freeze(
    NormalizedMeshSchema.parse(landmarks).map((point) => Object.freeze(point)),
  )
  const named = Object.freeze({
    forehead: pointAt(points, 10),
    chin: pointAt(points, 152),
    screenLeftCheek: pointAt(points, 234),
    screenRightCheek: pointAt(points, 454),
    noseTip: pointAt(points, 1),
    noseBridgeUpper: pointAt(points, 168),
    noseBridgeLower: pointAt(points, 6),
    screenLeftEyeOuter: pointAt(points, 33),
    screenLeftEyeInner: pointAt(points, 133),
    screenLeftEyeUpper: pointAt(points, 159),
    screenLeftEyeLower: pointAt(points, 145),
    screenRightEyeOuter: pointAt(points, 263),
    screenRightEyeInner: pointAt(points, 362),
    screenRightEyeUpper: pointAt(points, 386),
    screenRightEyeLower: pointAt(points, 374),
  })
  return Object.freeze({ points, named })
}

export class FaceLandmarksError extends Error {
  readonly name = "FaceLandmarksError"

  constructor(readonly missingIndex: number) {
    super(`Face landmark result does not contain index ${missingIndex}`)
  }
}

function pointAt(landmarks: readonly LandmarkPoint[], index: number): Point {
  const landmark = landmarks[index]
  if (landmark === undefined) {
    throw new FaceLandmarksError(index)
  }

  return Object.freeze({ x: landmark.x, y: landmark.y })
}

function midpoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  }
}

export function extractFaceAnchors(landmarks: readonly LandmarkPoint[]): FaceAnchors {
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  for (const landmark of landmarks) {
    left = Math.min(left, landmark.x)
    right = Math.max(right, landmark.x)
  }
  return {
    leftEye: midpoint(pointAt(landmarks, 33), pointAt(landmarks, 133)),
    rightEye: midpoint(pointAt(landmarks, 362), pointAt(landmarks, 263)),
    noseTip: pointAt(landmarks, 1),
    forehead: pointAt(landmarks, 10),
    chin: pointAt(landmarks, 152),
    leftCheek: pointAt(landmarks, 234),
    rightCheek: pointAt(landmarks, 454),
    mouthLeft: pointAt(landmarks, 61),
    mouthRight: pointAt(landmarks, 291),
    upperLipInner: pointAt(landmarks, 13),
    lowerLipInner: pointAt(landmarks, 14),
    outline: { left, right },
  }
}

export type PoseLandmarkPoint = LandmarkPoint & {
  readonly visibility?: number | undefined
}

// MediaPipe PoseLandmarker 33점 중 어깨: 11 = 환자 좌측 어깨, 12 = 환자 우측 어깨.
// 두 점이 없으면 null — 어깨는 보조 측정이라 얼굴 분석을 막지 않는다.
export const POSE_LEFT_SHOULDER_INDEX = 11
export const POSE_RIGHT_SHOULDER_INDEX = 12

export function extractShoulderAnchors(
  landmarks: readonly PoseLandmarkPoint[],
): ShoulderAnchors | null {
  const left = landmarks[POSE_LEFT_SHOULDER_INDEX]
  const right = landmarks[POSE_RIGHT_SHOULDER_INDEX]
  if (left === undefined || right === undefined) {
    return null
  }
  return {
    left: { x: left.x, y: left.y },
    right: { x: right.x, y: right.y },
    visibility: Math.min(left.visibility ?? 0, right.visibility ?? 0),
  }
}
