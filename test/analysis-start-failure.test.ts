import { describe, expect, it } from "vitest"

import { ModelFetchError, ModelIntegrityError } from "../src/adapters/model-integrity"
import { analysisStartFailure } from "../src/product/analysis-start-failure"

describe("analysisStartFailure", () => {
  it("tells an integrity mismatch apart from a generic start failure — no retry advice", () => {
    const failure = analysisStartFailure(new ModelIntegrityError("pose", "aa", "bb"))
    expect(failure.eventKey).toBe("model_integrity_failed")
    expect(failure.text).toContain("분석을 시작하지 않습니다")
    expect(failure.text).not.toContain("다시 시도해")
  })

  it("names a download failure and keeps the generic message for everything else", () => {
    expect(analysisStartFailure(new ModelFetchError("face", 404)).eventKey).toBe(
      "model_fetch_failed",
    )
    expect(analysisStartFailure(new Error("wasm")).eventKey).toBe("model_start_failed")
    expect(analysisStartFailure(undefined).title).toBe("로컬 분석 모델을 준비하지 못했습니다")
  })
})
