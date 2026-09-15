// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { type PhotoPose, photoId, VIEW_IDS } from "../src/domain/types"
import type { WorkspacePhoto, WorkspaceSourcePhoto } from "../src/domain/workspace"
import { SequenceRail } from "../src/product/sequence-rail"

const image = document.createElement("canvas")

const pose = (id: string, yawScore: number, pitchScore = 0.37): PhotoPose => ({
  id: photoId(id),
  yawScore,
  pitchScore,
  rollDegrees: 0,
  confidence: 0.9,
  bounds: { left: 0.25, top: 0.15, right: 0.75, bottom: 0.85 },
  anchor: { x: 0.5, y: 0.5 },
  eyeCenter: { x: 0.5, y: 0.4 },
})

const photo = (view: WorkspacePhoto<CanvasImageSource>["view"], yawScore: number) => ({
  adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
  assignmentMethod: "auto" as const,
  image,
  pose: pose(view, yawScore),
  sourceSize: { width: 800, height: 1000 },
  view,
})

const spare = (id: string, yawScore: number): WorkspaceSourcePhoto<CanvasImageSource> => ({
  image,
  pose: pose(id, yawScore),
  sourceSize: { width: 800, height: 1000 },
})

function renderRail(
  spares: readonly WorkspaceSourcePhoto<CanvasImageSource>[],
  onSwapSpare: (sparePhotoId: string, targetView: string) => void,
) {
  return render(
    <SequenceRail
      failures={[]}
      framing={FRAMING_PRESETS.clinicalStandard}
      lateralityConflicts={[]}
      mismatchViews={[]}
      mixupViews={[]}
      onMove={() => undefined}
      onReorder={() => undefined}
      onRetryTrayFailure={() => undefined}
      onSelect={() => undefined}
      onSwapSpare={onSwapSpare}
      photos={[photo("front", 0), photo("leftOblique", -0.44), photo("rightProfile", 1.0)]}
      pitchMedian={0.37}
      sequenceOrder={VIEW_IDS}
      selectedView="rightOblique"
      spares={spares}
      trayFailures={[]}
    />,
  )
}

describe("SequenceRail spare tray", () => {
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

  afterEach(() => {
    cleanup()
    getContext.mockClear()
  })

  it("labels each spare with its measured view and targets that view first", () => {
    // 2026-09-02 bee 지적: 선택 뷰 이름만 붙은 "우측 45도와 교체"가 추천처럼 읽혔다.
    const onSwapSpare = vi.fn()
    renderRail([spare("dup-left-oblique", -0.44)], onSwapSpare)

    expect(screen.getByText("측정: 좌측 45도")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "좌측 45도와 교체" }))
    expect(onSwapSpare).toHaveBeenCalledWith("dup-left-oblique", "leftOblique")

    // 선택한 뷰(우측 45도)는 비어 있으므로 '배치'로, 보조 버튼으로 남는다.
    fireEvent.click(screen.getByRole("button", { name: "선택한 우측 45도에 배치" }))
    expect(onSwapSpare).toHaveBeenCalledWith("dup-left-oblique", "rightOblique")
  })

  it("falls back to the selected view when a spare has no landmarks", () => {
    const onSwapSpare = vi.fn()
    const { eyeCenter: _dropped, ...landmarkless } = pose("manual-spare", 0)
    renderRail(
      [{ image, pose: landmarkless, sourceSize: { width: 800, height: 1000 } }],
      onSwapSpare,
    )

    expect(screen.getByText("측정값 없음")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "우측 45도에 배치" }))
    expect(onSwapSpare).toHaveBeenCalledWith("manual-spare", "rightOblique")
    expect(screen.queryByText(/^선택한/)).toBeNull()
  })
})
