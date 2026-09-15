import { describe, expect, it } from "vitest"

import {
  FaceDetectionError,
  LOCAL_FACE_MODEL_URL,
  LOCAL_POSE_MODEL_URL,
  LOCAL_WASM_BASE_URL,
  MODEL_SHA256,
  metricsFromDetection,
  shouldersFromDetection,
} from "../src/adapters/mediapipe"
import { analyzePhotoBatch } from "../src/services/analyze-batch"

type Landmark = {
  readonly x: number
  readonly y: number
}

function detectedFace(): Landmark[] {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  landmarks[33] = { x: 0.3, y: 0.4 }
  landmarks[133] = { x: 0.4, y: 0.4 }
  landmarks[362] = { x: 0.6, y: 0.4 }
  landmarks[263] = { x: 0.7, y: 0.4 }
  landmarks[1] = { x: 0.56, y: 0.57 }
  landmarks[10] = { x: 0.5, y: 0.17 }
  landmarks[152] = { x: 0.5, y: 0.88 }
  landmarks[234] = { x: 0.2, y: 0.58 }
  landmarks[454] = { x: 0.8, y: 0.58 }
  return landmarks
}

describe("metricsFromDetection", () => {
  it("maps a MediaPipe face result into scale-independent domain metrics", () => {
    // Given: one complete face mesh returned by the detector.
    const result = { faceLandmarks: [detectedFace()] }

    // When: the adapter translates the external result.
    const metrics = metricsFromDetection(result)

    // Then: the domain receives the expected pose direction and geometry.
    expect(metrics.yawScore).toBeCloseTo(0.1, 3)
    expect(metrics.rollDegrees).toBeCloseTo(0, 3)
    expect(metrics.bounds).toEqual({ left: 0.2, top: 0.17, right: 0.8, bottom: 0.88 })
    expect(metrics.registrationAnchors?.screenLeftEye.x).toBeCloseTo(0.35, 10)
    expect(metrics.registrationAnchors?.screenRightEye.x).toBeCloseTo(0.65, 10)
    expect(metrics.registrationAnchors?.noseTip).toEqual({ x: 0.56, y: 0.57 })
  })

  it("emits a typed error when no face is present", () => {
    // Given: a valid detector response without a face.
    const result = { faceLandmarks: [] }

    // When/Then: the adapter exposes a recoverable no-face error.
    expect(() => metricsFromDetection(result)).toThrow(FaceDetectionError)
  })
})

describe("registration anchor propagation", () => {
  it("retains detected normalized screen-side anchors through a real batch item", async () => {
    const file = new File(["synthetic"], "synthetic.png", { type: "image/png" })
    const decoded = { image: { marker: "decoded" }, width: 752, height: 940 } as const
    const items = await analyzePhotoBatch([file], {
      decode: async () => decoded,
      analyze: () => metricsFromDetection({ faceLandmarks: [detectedFace()] }),
      classifyError: () => "analysis_failed",
      yieldControl: async () => {},
    })

    const item = items[0]
    expect(item).toMatchObject({ kind: "ready", decoded: { width: 752, height: 940 } })
    if (item?.kind === "ready") {
      expect(item.pose.registrationAnchors?.screenLeftEye.x).toBeCloseTo(0.35, 10)
      expect(item.pose.registrationAnchors?.screenRightEye.x).toBeCloseTo(0.65, 10)
      expect(item.pose.registrationAnchors?.noseTip).toEqual({ x: 0.56, y: 0.57 })
    }
  })
})

describe("local MediaPipe assets", () => {
  it("uses same-origin static paths for both the model and WASM runtime", () => {
    // Given: the production browser adapter.

    // When: its default asset locations are read.

    // Then: no remote storage or CDN origin is needed to start face analysis.
    expect(LOCAL_FACE_MODEL_URL).toBe("/models/face_landmarker.task")
    expect(LOCAL_POSE_MODEL_URL).toBe("/models/pose_landmarker_lite.task")
    expect(LOCAL_WASM_BASE_URL).toBe("/wasm")
  })

  it("pins both task models to SHA-256 digests recorded in the third-party notice", () => {
    expect(MODEL_SHA256.face).toMatch(/^[0-9a-f]{64}$/)
    expect(MODEL_SHA256.pose).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("shouldersFromDetection", () => {
  it("maps the first detected pose's shoulders and tolerates an empty result", () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }))
    landmarks[11] = { x: 0.64, y: 0.7, visibility: 0.9 }
    landmarks[12] = { x: 0.36, y: 0.7, visibility: 0.8 }

    expect(shouldersFromDetection({ landmarks: [landmarks] })).toEqual({
      left: { x: 0.64, y: 0.7 },
      right: { x: 0.36, y: 0.7 },
      visibility: 0.8,
    })
    expect(shouldersFromDetection({ landmarks: [] })).toBeUndefined()
  })
})
