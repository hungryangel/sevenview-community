import { ModelFetchError, ModelIntegrityError } from "../adapters/model-integrity"

export type AnalysisStartFailure = {
  readonly eventKey: "model_start_failed" | "model_integrity_failed" | "model_fetch_failed"
  readonly text: string
  readonly title: string
}

// 분석 시작 실패 문구. 모델 무결성 불일치는 "다시 시도"가 답이 아니라 배포 점검이
// 답이므로 일반 실패와 구분해 말한다(2026-09-02 배포 보안처리).
export function analysisStartFailure(error: unknown): AnalysisStartFailure {
  if (error instanceof ModelIntegrityError) {
    return {
      eventKey: "model_integrity_failed",
      title: "분석 모델 파일이 검증에 실패했습니다",
      text: "배포된 모델 파일이 이 버전에 고정된 값과 다릅니다. 안전을 위해 분석을 시작하지 않습니다 — 다시 시도하지 말고 배포 상태를 확인해 주세요.",
    }
  }
  if (error instanceof ModelFetchError) {
    return {
      eventKey: "model_fetch_failed",
      title: "분석 모델 파일을 받지 못했습니다",
      text: "모델 파일을 이 앱의 서버에서 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 새로 고쳐 주세요.",
    }
  }
  return {
    eventKey: "model_start_failed",
    title: "로컬 분석 모델을 준비하지 못했습니다",
    text: "브라우저가 포함된 분석 모델을 시작하지 못했습니다. 브라우저를 새로 열고 다시 시도해 주세요.",
  }
}
