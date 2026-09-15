import type { AnalysisFailureCode } from "../domain/types"

const ANALYSIS_FAILURE_COPY = {
  face_not_detected: "얼굴을 찾지 못했습니다",
  decode_failed: "파일을 읽지 못했습니다",
  analysis_failed: "분석을 완료하지 못했습니다",
} as const satisfies Record<AnalysisFailureCode, string>

export function analysisFailureCopy(code: AnalysisFailureCode): string {
  return ANALYSIS_FAILURE_COPY[code]
}
