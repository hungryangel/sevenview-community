import {
  FaceLandmarker,
  FilesetResolver,
  type ImageSource,
  PoseLandmarker,
} from "@mediapipe/tasks-vision"

import { analyzeFaceAnchors } from "../domain/geometry"
import type { FaceMetrics, ShoulderAnchors } from "../domain/types"
import { FaceDetectionError } from "./face-error"
import {
  extractFaceAnchors,
  extractFaceLandmarkGeometry,
  extractShoulderAnchors,
  type LandmarkPoint,
  type PoseLandmarkPoint,
} from "./landmarks"
import { fetchVerifiedModel } from "./model-integrity"
import { recoverProfile } from "./profile-recovery"

export { FaceDetectionError } from "./face-error"
export { ModelFetchError, ModelIntegrityError } from "./model-integrity"

export const LOCAL_FACE_MODEL_URL = `${import.meta.env.BASE_URL}models/face_landmarker.task`
export const LOCAL_POSE_MODEL_URL = `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`
export const LOCAL_WASM_BASE_URL = `${import.meta.env.BASE_URL}wasm`

// 배포 모델 고정 해시(SHA-256). THIRD_PARTY_NOTICES.md의 기록과 같아야 하며, 모델을
// 바꾸면 여기와 고지를 함께 갱신한다 — 다른 파일이면 분석을 시작하지 않는다(fail-closed).
export const MODEL_SHA256 = {
  face: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
  pose: "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a",
} as const

type DetectionResult = {
  readonly faceLandmarks: readonly (readonly LandmarkPoint[])[]
}

type PoseDetectionResult = {
  readonly landmarks: readonly (readonly PoseLandmarkPoint[])[]
}

export interface FaceAnalyzer {
  analyze(image: ImageSource, signal?: AbortSignal): Promise<FaceMetrics>
  close(): void
}

export function metricsFromDetection(result: DetectionResult): FaceMetrics {
  const landmarks = result.faceLandmarks[0]
  if (landmarks === undefined) {
    throw new FaceDetectionError("no_face")
  }

  const landmarkGeometry = extractFaceLandmarkGeometry(landmarks)
  return { ...analyzeFaceAnchors(extractFaceAnchors(landmarkGeometry.points)), landmarkGeometry }
}

export function shouldersFromDetection(result: PoseDetectionResult): ShoulderAnchors | undefined {
  const landmarks = result.landmarks[0]
  if (landmarks === undefined) {
    return undefined
  }
  return extractShoulderAnchors(landmarks) ?? undefined
}

class MediaPipeFaceAnalyzer implements FaceAnalyzer {
  constructor(
    private readonly faceLandmarker: FaceLandmarker,
    private readonly poseLandmarker: PoseLandmarker,
  ) {}

  async analyze(image: ImageSource, signal?: AbortSignal): Promise<FaceMetrics> {
    const detected = this.faceLandmarker.detect(image)
    const metrics =
      detected.faceLandmarks.length > 0
        ? metricsFromDetection(detected)
        : await recoverProfile(this.faceLandmarker, image, signal)
    const shoulders = this.detectShoulders(image)
    return shoulders === undefined ? metrics : { ...metrics, shoulders }
  }

  // 어깨는 보조 측정이다 — 포즈 추정이 실패해도 얼굴 분석 결과를 버리지 않는다.
  private detectShoulders(image: ImageSource): ShoulderAnchors | undefined {
    try {
      return shouldersFromDetection(this.poseLandmarker.detect(image))
    } catch {
      return undefined
    }
  }

  close(): void {
    this.faceLandmarker.close()
    this.poseLandmarker.close()
  }
}

export async function createMediaPipeFaceAnalyzer(): Promise<FaceAnalyzer> {
  const [wasmFileset, faceModel, poseModel] = await Promise.all([
    FilesetResolver.forVisionTasks(LOCAL_WASM_BASE_URL),
    fetchVerifiedModel(LOCAL_FACE_MODEL_URL, MODEL_SHA256.face, "face_landmarker"),
    fetchVerifiedModel(LOCAL_POSE_MODEL_URL, MODEL_SHA256.pose, "pose_landmarker_lite"),
  ])
  const faceLandmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
    baseOptions: {
      delegate: "CPU",
      modelAssetBuffer: faceModel,
    },
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: "IMAGE",
  })
  const poseLandmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
    baseOptions: {
      delegate: "CPU",
      modelAssetBuffer: poseModel,
    },
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    numPoses: 1,
    outputSegmentationMasks: false,
    runningMode: "IMAGE",
  })

  return new MediaPipeFaceAnalyzer(faceLandmarker, poseLandmarker)
}
