// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { SessionPhotoMeta } from "../src/domain/session-mixup"
import { WorkspaceSetOverview } from "../src/product/workspace-set-overview"
import {
  overviewFailure,
  overviewPhoto,
  overviewWorkspace,
} from "./workspace-set-overview-fixtures"

afterEach(cleanup)

describe("WorkspaceSetOverview", () => {
  it("opens each selected view through a labelled status button", () => {
    // Given: the four distinct view states share the existing selection callback.
    const onSelect = vi.fn()
    render(
      <WorkspaceSetOverview
        onSelect={onSelect}
        reviewQueue={[{ view: "rightOblique", reasons: ["diagnostic"] }]}
        workspace={{
          ...overviewWorkspace(),
          failures: [overviewFailure("leftOblique")],
          photos: [overviewPhoto("front"), overviewPhoto("rightOblique")],
        }}
      />,
    )

    // When: the operator selects the failed view for recovery.
    fireEvent.click(screen.getByRole("button", { name: "좌측 45도 · 분석 실패" }))

    // Then: the callback receives that view and other states remain distinguishable.
    expect(onSelect).toHaveBeenCalledWith("leftOblique")
    expect(screen.getByRole("button", { name: "정면 · 배치됨" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "우측 45도 · 확인 필요" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "우측 측면 · 사진 없음" })).toBeTruthy()
  })

  it("shows the current set context with explicitly unknown capture dates", () => {
    // Given: one assigned photo and non-output sources with no EXIF.
    const workspace = {
      ...overviewWorkspace(),
      photos: [overviewPhoto("front")],
      spares: [overviewPhoto("chinUp")],
      trayFailures: [overviewFailure("crownDown")],
    }

    // When: the current set summary is shown.
    render(
      <WorkspaceSetOverview workspace={workspace} reviewQueue={[]} onSelect={() => undefined} />,
    )

    // Then: operator-visible context never labels the session date as a capture date.
    expect(screen.getByRole("region", { name: "촬영 세트 현황" })).toBeTruthy()
    expect(screen.getByText(workspace.sessionName)).toBeTruthy()
    expect(screen.getByText("표준 7뷰")).toBeTruthy()
    expect(screen.getByText("촬영일 미확인 · EXIF 정보 없음")).toBeTruthy()
    expect(screen.getByText("출력 미포함 · 예비 1장 · 미배치 실패 1장")).toBeTruthy()
  })

  it("exposes multiple capture days and the number of unknown dates", () => {
    // Given: one undated photo and two different EXIF capture days.
    const dates = new Map<string, SessionPhotoMeta>([
      [
        "front",
        { key: "front", fileName: "front.png", camera: null, captureTime: new Date(2026, 8, 7) },
      ],
      [
        "rightOblique",
        {
          key: "rightOblique",
          fileName: "right.png",
          camera: null,
          captureTime: new Date(2026, 8, 9),
        },
      ],
    ])
    const workspace = {
      ...overviewWorkspace(),
      photos: [overviewPhoto("front"), overviewPhoto("rightOblique"), overviewPhoto("leftOblique")],
      getPhotoMeta: (key: string) => dates.get(key),
    }

    // When: the date summary is rendered.
    render(
      <WorkspaceSetOverview workspace={workspace} reviewQueue={[]} onSelect={() => undefined} />,
    )

    // Then: known days and incomplete coverage are both readable.
    expect(screen.getByText("2026-09-07 · 2026-09-09")).toBeTruthy()
    expect(screen.getByText("여러 날짜")).toBeTruthy()
    expect(screen.getByText("1장 촬영일 미확인")).toBeTruthy()
  })

  it("edits the existing shared session name through the optional disclosure", () => {
    // Given: a real controlled React state owns the working session name.
    function SetNameHarness() {
      const [sessionName, setSessionName] = useState("처음 세트")
      return (
        <WorkspaceSetOverview
          workspace={{ ...overviewWorkspace(), sessionName, setSessionName }}
          reviewQueue={[]}
          onSelect={() => undefined}
        />
      )
    }
    render(<SetNameHarness />)
    fireEvent.click(screen.getByText("세트 정보 수정"))

    // When: the operator changes the work-set name.
    fireEvent.change(screen.getByLabelText("작업 세트명"), { target: { value: "오전 촬영" } })

    // Then: the same controlled name updates the overview without introducing patient fields.
    expect(screen.getByText("오전 촬영")).toBeTruthy()
    expect(screen.queryByLabelText("세션명")).toBeNull()
    expect(screen.queryByLabelText("환자 라벨 (선택)")).toBeNull()
  })

  it.each(["exporting", "newSetAnalyzing"] as const)(
    "locks view selection and name edits during %s",
    (busyFlag) => {
      // Given: the existing workspace is busy.
      const onSelect = vi.fn()
      render(
        <WorkspaceSetOverview
          workspace={{ ...overviewWorkspace(), [busyFlag]: true }}
          reviewQueue={[]}
          onSelect={onSelect}
        />,
      )

      // When: a view action is attempted.
      fireEvent.click(screen.getByRole("button", { name: "정면 · 사진 없음" }))

      // Then: mutation controls remain unavailable until the existing operation ends.
      expect(onSelect).not.toHaveBeenCalled()
      expect(screen.getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(
        true,
      )
      expect(screen.getByLabelText("작업 세트명").hasAttribute("disabled")).toBe(true)
    },
  )
})
