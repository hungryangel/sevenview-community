// @vitest-environment jsdom
import type { FaceLandmarker, FaceLandmarkerResult, ImageSource } from "@mediapipe/tasks-vision"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FACE_MIRROR_INDICES } from "../src/adapters/face-mirror-topology"
import { recoverProfile } from "../src/adapters/profile-recovery"

vi.mock("../src/services/browser-yield", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/browser-yield")>()
  return {
    ...actual,
    yieldToBrowser: async (signal?: AbortSignal) => actual.throwIfAborted(signal),
  }
})

function model() {
  return {
    setOptions: vi.fn(async (_options: Parameters<FaceLandmarker["setOptions"]>[0]) => {}),
    detect: vi.fn(
      (_image: ImageSource): FaceLandmarkerResult => ({
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      }),
    ),
  }
}

describe("bounded profile recovery lifecycle", () => {
  const originalGetContext = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "getContext",
  )
  beforeEach(() => {
    vi.stubGlobal("ImageData", class {})
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ({
        resetTransform: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        restore: vi.fn(),
      }),
    })
  })
  afterEach(() => {
    if (originalGetContext !== undefined)
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", originalGetContext)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns a real agreeing mesh on success and releases only its analysis canvas", async () => {
    const points = Array.from({ length: 478 }, () => ({ x: 0.65, y: 0.5, z: 0, visibility: 1 }))
    const anchors: Readonly<Record<number, readonly [number, number]>> = {
      10: [0.7, 0.2],
      152: [0.7, 0.85],
      168: [0.76, 0.38],
      6: [0.79, 0.45],
      1: [0.87, 0.56],
      33: [0.66, 0.4],
      133: [0.76, 0.4],
      263: [0.8, 0.4],
      362: [0.81, 0.4],
      234: [0.5, 0.5],
      454: [0.65, 0.5],
      13: [0.79, 0.68],
    }
    for (const [index, [x, y]] of Object.entries(anchors))
      points[Number(index)] = { x, y, z: 0, visibility: 1 }
    const reflected = FACE_MIRROR_INDICES.map((index) => {
      const p = points[index]
      if (p === undefined) throw new Error("Missing fixture")
      return { ...p, x: 1 - p.x }
    })
    const detector = model()
    detector.detect
      .mockReturnValueOnce({
        faceLandmarks: [points],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      })
      .mockReturnValueOnce({
        faceLandmarks: [reflected],
        faceBlendshapes: [],
        facialTransformationMatrixes: [],
      })
    const source = document.createElement("canvas")
    source.width = source.height = 640
    const result = await recoverProfile(detector, source)
    expect(result.detectionMethod).toBe("profile_recovery")
    expect(result.landmarkGeometry?.named.noseTip.x).toBeCloseTo(0.87, 12)
    expect(detector.detect).toHaveBeenCalledTimes(2)
    expect(detector.setOptions).toHaveBeenLastCalledWith({
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
    })
    expect(detector.detect.mock.calls[0]?.[0]).toMatchObject({ width: 1, height: 1 })
    expect(source.width).toBe(640)
  })

  it("does not fabricate points for a blank image and restores default thresholds after 18 attempts", async () => {
    const detector = model()
    const source = document.createElement("canvas")
    source.width = 344
    source.height = 394
    await expect(recoverProfile(detector, source)).rejects.toMatchObject({ code: "no_face" })
    expect(detector.detect).toHaveBeenCalledTimes(18)
    expect(detector.setOptions.mock.calls).toEqual([
      [{ minFaceDetectionConfidence: 0.2, minFacePresenceConfidence: 0.2 }],
      [{ minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5 }],
    ])
    expect(source.width).toBe(344)
    expect(source.height).toBe(394)
    for (const [canvas] of detector.detect.mock.calls) expect(canvas).not.toBe(source)
  })

  it("stops cancelled retries and restores thresholds without converting cancellation into no-face", async () => {
    const detector = model()
    const controller = new AbortController()
    detector.detect.mockImplementationOnce(() => {
      controller.abort()
      return { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] }
    })
    await expect(
      recoverProfile(detector, document.createElement("canvas"), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(detector.detect).toHaveBeenCalledTimes(1)
    expect(detector.setOptions).toHaveBeenLastCalledWith({
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
    })
  })

  it("restores thresholds when the underlying inference throws", async () => {
    const detector = model()
    detector.detect.mockImplementationOnce(() => {
      throw new Error("inference failed")
    })
    await expect(recoverProfile(detector, document.createElement("canvas"))).rejects.toThrow(
      "inference failed",
    )
    expect(detector.setOptions).toHaveBeenLastCalledWith({
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
    })
  })
})
