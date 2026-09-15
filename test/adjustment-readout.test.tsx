// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { AdjustmentReadout, signedDegrees, signedPercent } from "../src/product/adjustment-readout"

afterEach(() => {
  cleanup()
})

describe("AdjustmentReadout", () => {
  it("always writes the sign so the direction reads at a glance", () => {
    // 2026-09-03 부호 규약: 가로 +=오른쪽, 세로 +=위, 회전 +=시계.
    expect(signedPercent(0.03)).toBe("+3%")
    expect(signedPercent(-0.02)).toBe("-2%")
    expect(signedPercent(0)).toBe("0%")
    expect(signedDegrees(1)).toBe("+1.0°")
    expect(signedDegrees(-1.25)).toBe("-1.3°")
    expect(signedDegrees(0)).toBe("0.0°")
  })

  it("lists 가로 · 세로 · 회전 in that order and marks only the changed ones", () => {
    render(
      <AdjustmentReadout
        adjustment={{ panX: 0.01, panY: -0.01, rotationDegrees: 0, scaleMultiplier: 1.05 }}
      />,
    )
    const readout = screen.getByLabelText("보정 수치")
    const items = [...readout.querySelectorAll(".adjustment-readout__item")]
    expect(items.map((item) => item.textContent)).toEqual(["가로 +1%", "세로 -1%", "회전 0.0°"])
    expect(items.map((item) => item.getAttribute("data-changed"))).toEqual([
      "true",
      "true",
      "false",
    ])
  })
})
