import { describe, expect, it } from "vitest"

import { reviewDiagnostics, reviewDiagnosticViewIds } from "../src/domain/review-diagnostics"
import { type PhotoPose, photoId } from "../src/domain/types"

function pose(patch: Partial<PhotoPose> = {}): PhotoPose {
  return {
    id: photoId("diagnostic-photo"),
    yawScore: 0,
    pitchScore: 0.5,
    rollDegrees: 0,
    confidence: 0.94,
    bounds: { left: 0.25, top: 0.15, right: 0.75, bottom: 0.85 },
    anchor: { x: 0.5, y: 0.5 },
    ...patch,
  }
}

describe("reviewDiagnostics", () => {
  it("suggests review for a tilted horizon as a non-blocking, dismissible note", () => {
    const diagnostics = reviewDiagnostics("rightProfile", pose({ rollDegrees: 8 }))

    expect(diagnostics.map((diagnostic) => diagnostic.kind)).toEqual(["roll"])
    expect(diagnostics[0]?.message).toContain("우측 측면")
    expect(diagnostics.every((diagnostic) => diagnostic.dismissible)).toBe(true)
    expect(diagnostics.every((diagnostic) => diagnostic.blocking === false)).toBe(true)
  })

  it("no longer re-judges yaw or pitch with a second ruler (각도는 배치 거부권 소관)", () => {
    // 2026-09-01 실측값 — 폐기된 절대 기대표라면 전부 "기준 범위 밖"이던 값들.
    expect(reviewDiagnostics("rightOblique", pose({ yawScore: 0.436, pitchScore: 0.36 }))).toEqual(
      [],
    )
    expect(reviewDiagnostics("rightProfile", pose({ yawScore: 1.027, pitchScore: 0.358 }))).toEqual(
      [],
    )
    expect(reviewDiagnostics("chinUp", pose({ pitchScore: 0.047 }))).toEqual([])
  })

  it("keeps a level pose free from suggestions", () => {
    expect(reviewDiagnostics("front", pose())).toEqual([])
  })

  it("counts a flagged view once and honors dismissal", () => {
    const photo = { view: "rightProfile" as const, pose: pose({ rollDegrees: 8 }) }

    expect(reviewDiagnosticViewIds([photo], [])).toEqual(["rightProfile"])
    expect(reviewDiagnosticViewIds([photo], ["rightProfile:roll"])).toEqual([])
  })
})
