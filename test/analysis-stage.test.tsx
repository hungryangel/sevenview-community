// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { advanceAnalysisJourney, beginAnalysisJourney } from "../src/domain/analysis-journey"
import { AnalysisStage } from "../src/product/analysis-stage"

describe("AnalysisStage", () => {
  it("keeps originals visible and draws only emitted anchors", () => {
    const onCancel = vi.fn()
    const journey = advanceAnalysisJourney(beginAnalysisJourney(1, 2), {
      type: "itemDetected",
      generation: 1,
      index: 0,
      anchors: {
        screenLeftEye: { x: 0.25, y: 0.35 },
        screenRightEye: { x: 0.75, y: 0.35 },
        noseTip: { x: 0.5, y: 0.55 },
      },
    })
    render(
      <AnalysisStage
        active
        files={[{ previewUrl: "blob:one" }, { previewUrl: "blob:two" }]}
        journey={journey}
        onCancel={onCancel}
      />,
    )

    expect(screen.getAllByRole("img", { name: /분석 원본/ })).toHaveLength(2)
    expect(screen.getByLabelText("실제 감지 기준점").children).toHaveLength(3)
    expect(screen.queryByText("감지 기준점 없음")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "분석 취소" }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
