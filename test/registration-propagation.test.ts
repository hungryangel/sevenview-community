import { describe, expect, it } from "vitest"

import { metricsFromDetection } from "../src/adapters/mediapipe"
import { comparisonSessionReducer, createComparisonSession } from "../src/domain/comparison-session"
import { analyzePhotoBatch } from "../src/services/analyze-batch"

function asymmetricLandmarks() {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  points[33] = { x: 0.11, y: 0.31 }
  points[133] = { x: 0.21, y: 0.33 }
  points[362] = { x: 0.71, y: 0.41 }
  points[263] = { x: 0.91, y: 0.43 }
  points[1] = { x: 0.63, y: 0.57 }
  points[10] = { x: 0.5, y: 0.1 }
  points[152] = { x: 0.5, y: 0.9 }
  points[234] = { x: 0.2, y: 0.6 }
  points[454] = { x: 0.8, y: 0.6 }
  return points
}

describe("registration anchor handoff", () => {
  it("preserves asymmetric screen-side points through adapter, batch, and ready slot", async () => {
    const file = new File(["synthetic"], "synthetic.png", { type: "image/png" })
    const decoded = { image: "decoded", width: 752, height: 940 } as const
    const items = await analyzePhotoBatch([file], {
      analyze: () => metricsFromDetection({ faceLandmarks: [asymmetricLandmarks()] }),
      classifyError: () => "analysis_failed",
      decode: async () => decoded,
      yieldControl: async () => {},
    })
    const item = items[0]
    expect(item?.kind).toBe("ready")
    if (item?.kind !== "ready") return
    let session = comparisonSessionReducer(createComparisonSession<string>(), {
      type: "select",
      side: "before",
      file,
      previewUrl: "blob:synthetic",
    })
    session = comparisonSessionReducer(session, { type: "start", sides: ["before"] })
    session = comparisonSessionReducer(session, {
      type: "ready",
      side: "before",
      file,
      decoded: item.decoded,
      pose: item.pose,
    })
    expect(session.before).toMatchObject({ kind: "ready", decoded: { width: 752, height: 940 } })
    if (session.before.kind === "ready") {
      expect(session.before.pose.registrationAnchors).toEqual({
        screenLeftEye: { x: 0.16, y: 0.32 },
        screenRightEye: { x: 0.81, y: 0.42 },
        noseTip: { x: 0.63, y: 0.57 },
      })
      expect(session.before.pose.landmarkGeometry?.points).toHaveLength(478)
      expect(session.before.pose.landmarkGeometry?.named.screenLeftEyeOuter).toEqual({
        x: 0.11,
        y: 0.31,
      })
    }
  })
})
