// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ComparisonAngleControl } from "../src/product/comparison-angle-control"

afterEach(cleanup)

it("requires confirmation for different inferred directions but offers an explicit override", () => {
  const onChange = vi.fn()
  render(
    <ComparisonAngleControl
      resolution={{
        kind: "reviewRequired",
        reason: "angle_mismatch",
        before: "leftOblique",
        after: "front",
      }}
      override={null}
      disabled={false}
      onChange={onChange}
    />,
  )
  expect(screen.getByRole("status").textContent).toContain("다르게 감지")
  expect(screen.getByText("자동 감지 · 시술 전 좌측 45도 · 시술 후 정면")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("촬영 방향 직접 확인"), {
    target: { value: "leftOblique" },
  })
  expect(onChange).toHaveBeenCalledWith("leftOblique")
  fireEvent.change(screen.getByLabelText("촬영 방향 직접 확인"), { target: { value: "automatic" } })
  expect(onChange).toHaveBeenLastCalledWith(null)
})

it("does not offer an invalid-pose bypass", () => {
  render(
    <ComparisonAngleControl
      resolution={{ kind: "reviewRequired", reason: "invalid_pose", before: null, after: "front" }}
      override={null}
      disabled={false}
      onChange={() => undefined}
    />,
  )
  expect(screen.queryByRole("combobox")).toBeNull()
  expect(screen.getByRole("status").textContent).toContain("다시 분석")
})

it("labels manual confirmation without disguising the original auto detections", () => {
  render(
    <ComparisonAngleControl
      resolution={{
        kind: "ready",
        provenance: "manual",
        angle: "leftOblique",
        before: "leftOblique",
        after: "front",
      }}
      override="leftOblique"
      disabled
      onChange={() => undefined}
    />,
  )
  expect(screen.getByText("직접 확인한 방향 사용 중")).toBeTruthy()
  expect(screen.getByLabelText<HTMLSelectElement>("촬영 방향 직접 확인").disabled).toBe(true)
  expect(screen.getByText(/자동 감지 · 시술 전 좌측 45도 · 시술 후 정면/)).toBeTruthy()
})
