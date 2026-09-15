// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ComparisonAlignmentWorkbench } from "../src/product/comparison-alignment-workbench"
import { comparisonEditablePair } from "../src/product/comparison-editable-pair"
import type { ComparisonIntakeProps } from "../src/product/comparison-intake-types"

vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
afterEach(cleanup)
const failed = () => ({
  kind: "error" as const,
  code: "face_not_detected" as const,
  file: new File(["synthetic"], "synthetic.png"),
  previewUrl: "blob:synthetic",
  decoded: { image: document.createElement("canvas"), width: 400, height: 500 },
})
function props(): ComparisonIntakeProps {
  return {
    before: failed(),
    after: failed(),
    angle: "front",
    canAnalyze: false,
    canExport: false,
    exporting: false,
    exportMessage: null,
    progress: 100,
    onAnalyze: vi.fn(),
    onAngleChange: vi.fn(),
    onExport: vi.fn(),
    onRemove: vi.fn(),
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onReferencePairApply: vi.fn(() => true),
  }
}

it("adapts only decoded detection failures without changing source state or fabricating pose", () => {
  const before = failed(),
    after = failed()
  const pair = comparisonEditablePair(before, after)
  expect(pair?.before.kind).toBe("manual")
  expect(pair?.before.decoded).toBe(before.decoded)
  expect(pair?.before).not.toHaveProperty("pose")
  expect(before.kind).toBe("error")
  expect(comparisonEditablePair({ ...before, code: "decode_failed" }, after)).toBeNull()
})

it("opens paired recovery immediately and cancels without committing; reopening starts a new draft", () => {
  const input = props()
  render(<ComparisonAlignmentWorkbench props={input} disabled={false} />)
  expect(screen.getByRole("dialog")).toBeTruthy()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "rightProfile" } })
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "정렬 적용" }).disabled).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "취소" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(input.onReferencePairApply).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "두 사진 기준점 맞추기" }))
  expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe("")
})

it("discards pending drafts when inactive or busy and never commits during source replacement", () => {
  const input = props()
  const { rerender } = render(<ComparisonAlignmentWorkbench props={input} disabled={false} />)
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "rightProfile" } })
  rerender(<ComparisonAlignmentWorkbench props={{ ...input, after: failed() }} disabled={false} />)
  expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe("")
  rerender(<ComparisonAlignmentWorkbench props={input} disabled />)
  expect(screen.queryByRole("dialog")).toBeNull()
  rerender(<ComparisonAlignmentWorkbench props={{ ...input, active: false }} disabled={false} />)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(input.onReferencePairApply).not.toHaveBeenCalled()
})

it("invalidates an open draft when the external direction changes", () => {
  const input = props()
  const { rerender } = render(<ComparisonAlignmentWorkbench props={input} disabled={false} />)
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "rightProfile" } })
  rerender(
    <ComparisonAlignmentWorkbench
      props={{ ...input, angleOverride: "leftProfile" }}
      disabled={false}
    />,
  )
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(input.onReferencePairApply).not.toHaveBeenCalled()
})
