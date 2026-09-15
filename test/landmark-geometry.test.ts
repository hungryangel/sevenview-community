import { describe, expect, it } from "vitest"
import { metricsFromDetection } from "../src/adapters/mediapipe"
import { analyzePhotoBatch } from "../src/services/analyze-batch"

function mesh() {
  return Array.from({ length: 478 }, (_, index) => ({ x: index / 1000, y: index / 2000 }))
}

describe("retained detection geometry", () => {
  it("copies and freezes every normalized point when a real detector result is translated", () => {
    // Given a complete detector result with independently identifiable coordinates.
    const landmarks = mesh()
    // When metrics are produced.
    const metrics = metricsFromDetection({ faceLandmarks: [landmarks] })
    // Then complete geometry and named topology survive without sharing mutable SDK objects.
    expect(metrics.landmarkGeometry?.points).toEqual(landmarks)
    expect(metrics.landmarkGeometry?.points).not.toBe(landmarks)
    expect(Object.isFrozen(metrics.landmarkGeometry?.points)).toBe(true)
    expect(Object.isFrozen(metrics.landmarkGeometry?.points[168])).toBe(true)
    expect(metrics.landmarkGeometry?.named.noseBridgeUpper).toEqual({ x: 0.168, y: 0.084 })
    expect(metrics.landmarkGeometry?.named.noseBridgeLower).toEqual({ x: 0.006, y: 0.003 })
    expect(metrics.landmarkGeometry?.named.screenLeftEyeUpper).toEqual({ x: 0.159, y: 0.0795 })
    expect(metrics.landmarkGeometry?.named.screenRightEyeLower).toEqual({ x: 0.374, y: 0.187 })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects a raw non-finite mesh coordinate %s even outside the named anchors",
    (value) => {
      // Given invalid raw geometry at a non-anchor index.
      const landmarks = mesh()
      landmarks[400] = { x: value, y: 0.4 }
      // When / Then boundary parsing prevents non-finite coordinates entering local poses.
      expect(() => metricsFromDetection({ faceLandmarks: [landmarks] })).toThrow()
    },
  )

  it("propagates complete geometry through the batch handoff when analysis succeeds", async () => {
    // Given a synthetic local image and a complete synthetic detector response.
    const file = new File(["synthetic"], "synthetic.png", { type: "image/png" })
    // When the actual batch handoff constructs the pose.
    const items = await analyzePhotoBatch([file], {
      decode: async () => ({ image: "decoded", width: 752, height: 940 }),
      analyze: () => metricsFromDetection({ faceLandmarks: [mesh()] }),
      classifyError: () => "analysis_failed",
      yieldControl: async () => {},
    })
    // Then the session pose retains the entire mesh rather than only three anchors.
    const item = items[0]
    expect(item?.kind).toBe("ready")
    if (item?.kind === "ready") expect(item.pose.landmarkGeometry?.points).toHaveLength(478)
  })
})
