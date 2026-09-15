import { describe, expect, it } from "vitest"

import {
  adjustingActivity,
  deriveActivity,
  doneActivity,
  movedActivity,
  RECENT_ACTIVITY_VISIBLE_MS,
} from "../src/product/activity-status"

const base = {
  errorTitle: null,
  exporting: false,
  newSetAnalyzing: false,
  now: 10_000,
  pendingCount: 0,
  phase: "review" as const,
  progress: 0,
  recent: null,
  selectedView: "rightProfile" as const,
}

describe("deriveActivity", () => {
  it("prefers errors, then busy work, then the waiting state per phase", () => {
    expect(deriveActivity({ ...base, errorTitle: "분석 모델 파일이 검증에 실패했습니다" })).toEqual(
      {
        kind: "error",
        label: "분석 모델 파일이 검증에 실패했습니다",
      },
    )
    expect(deriveActivity({ ...base, phase: "analyzing", progress: 42.6 })).toEqual({
      kind: "busy",
      label: "분석 중 43%",
    })
    expect(deriveActivity({ ...base, exporting: true })).toEqual({
      kind: "busy",
      label: "PNG 내보내기 중",
    })
    expect(deriveActivity({ ...base, newSetAnalyzing: true, progress: 60 })).toEqual({
      kind: "busy",
      label: "새 세트 분석 중 60%",
    })
    expect(deriveActivity({ ...base, phase: "empty" })).toEqual({
      kind: "idle",
      label: "사진 대기",
    })
    expect(deriveActivity({ ...base, phase: "awaitingAnalysis", pendingCount: 5 })).toEqual({
      kind: "idle",
      label: "정렬 대기 · 5장",
    })
    expect(deriveActivity(base)).toEqual({ kind: "idle", label: "결과 검토 · 우측 측면" })
  })

  it("shows the most recent manipulation for a few seconds, then returns to waiting", () => {
    const recent = adjustingActivity("rightProfile", 9_000)
    expect(deriveActivity({ ...base, recent })).toEqual({
      kind: "busy",
      label: "우측 측면 보정 중",
    })
    expect(deriveActivity({ ...base, recent, now: 9_000 + RECENT_ACTIVITY_VISIBLE_MS }).label).toBe(
      "결과 검토 · 우측 측면",
    )
    expect(movedActivity("chinUp", 1).label).toBe("아래 (턱 밑)로 이동")
    expect(doneActivity("PNG 저장 완료", 1)).toEqual({
      at: 1,
      kind: "done",
      label: "PNG 저장 완료",
    })
  })
})
