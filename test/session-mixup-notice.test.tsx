// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SessionMixupNotice } from "../src/product/session-mixup-notice"

afterEach(() => {
  cleanup()
})

describe("SessionMixupNotice", () => {
  it("stays silent when there is no mixup signal", () => {
    const { container } = render(<SessionMixupNotice onDismiss={() => undefined} signals={[]} />)

    expect(container.textContent).toBe("")
  })

  it("names each signal, keeps the honest blind-spot line, and can be dismissed", () => {
    const onDismiss = vi.fn()
    render(
      <SessionMixupNotice
        onDismiss={onDismiss}
        signals={[
          { kind: "time_gap", maxGapMinutes: 42, offenders: ["photo-7"] },
          {
            kind: "camera_mismatch",
            cameras: ["Canon EOS R6", "Apple iPhone 15 Pro"],
            offenders: ["photo-7"],
          },
        ]}
      />,
    )

    expect(
      screen.getByText("다른 환자나 다른 촬영의 사진이 섞이지 않았는지 확인하세요"),
    ).toBeTruthy()
    expect(screen.getByText("촬영 시각이 42분 떨어진 사진이 있습니다.")).toBeTruthy()
    expect(
      screen.getByText(
        "서로 다른 카메라(Canon EOS R6, Apple iPhone 15 Pro)의 사진이 섞여 있습니다.",
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "표시된 슬롯의 사진을 교체하거나 직접 확인하세요. 연속으로 촬영된 다른 환자는 이 경고로 잡히지 않을 수 있습니다.",
      ),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
