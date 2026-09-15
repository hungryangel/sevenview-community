import type { ViewId } from "../domain/types"
import { VIEW_LABELS } from "../domain/workspace"

// 상단 상태 표시(2026-09-02 bee 요청): "로컬 처리" 고정 문구 대신 지금 무슨 일이 벌어지는지
// 보여준다. 입력을 기다릴 때는 점이 천천히 깜박이고, 오류는 붉게, 작업 중은 스피너.
export type ActivityKind = "idle" | "busy" | "done" | "error"

export type Activity = {
  readonly kind: ActivityKind
  readonly label: string
}

// 최근 조작 기록 한 줄 — 보정·이동·저장 같은 조작 직후 몇 초 동안 상태 표시에 남는다.
export type RecentActivity = {
  readonly at: number
  readonly kind: Extract<ActivityKind, "busy" | "done">
  readonly label: string
}

export const RECENT_ACTIVITY_VISIBLE_MS = 4_000

type ActivityInput = {
  readonly errorTitle: string | null
  readonly exporting: boolean
  readonly newSetAnalyzing: boolean
  readonly now: number
  readonly pendingCount: number
  readonly phase: "empty" | "awaitingAnalysis" | "analyzing" | "review"
  readonly progress: number
  readonly recent: RecentActivity | null
  readonly selectedView: ViewId
}

export function deriveActivity(input: ActivityInput): Activity {
  if (input.errorTitle !== null) {
    return { kind: "error", label: input.errorTitle }
  }
  if (input.phase === "analyzing") {
    return { kind: "busy", label: `분석 중 ${Math.round(input.progress)}%` }
  }
  if (input.newSetAnalyzing) {
    return { kind: "busy", label: `새 세트 분석 중 ${Math.round(input.progress)}%` }
  }
  if (input.exporting) {
    return { kind: "busy", label: "PNG 내보내기 중" }
  }
  if (input.phase === "empty") {
    return { kind: "idle", label: "사진 대기" }
  }
  if (input.phase === "awaitingAnalysis") {
    return { kind: "idle", label: `정렬 대기 · ${input.pendingCount}장` }
  }
  if (input.recent !== null && input.now - input.recent.at < RECENT_ACTIVITY_VISIBLE_MS) {
    return { kind: input.recent.kind, label: input.recent.label }
  }
  return { kind: "idle", label: `결과 검토 · ${VIEW_LABELS[input.selectedView]}` }
}

export function adjustingActivity(view: ViewId, now: number): RecentActivity {
  return { at: now, kind: "busy", label: `${VIEW_LABELS[view]} 보정 중` }
}

export function movedActivity(view: ViewId, now: number): RecentActivity {
  return { at: now, kind: "done", label: `${VIEW_LABELS[view]}로 이동` }
}

export function doneActivity(label: string, now: number): RecentActivity {
  return { at: now, kind: "done", label }
}
