// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ExportBar } from "../src/product/export-bar"
import { EMPTY_USAGE_LEDGER } from "../src/product/usage-ledger"
import { WorkspaceCommandBar } from "../src/product/workspace-command-bar"

afterEach(cleanup)

const initial = {
  disabled: false,
  exportCount: 0,
  onOpenExport: vi.fn(),
  patientLabel: "",
  photoCount: 3,
  reviewCount: 0,
  sessionPhotoCount: 3,
  totalViews: 7,
  usage: EMPTY_USAGE_LEDGER,
}

it("offers next set only for the currently exported revision", () => {
  const onNextSet = vi.fn()
  const { rerender } = render(<ExportBar {...initial} onNextSet={onNextSet} />)
  expect(screen.queryByRole("button", { name: "다음 세트" })).toBeNull()
  expect(screen.getByText("아직 내보내지 않음")).toBeTruthy()

  rerender(<ExportBar {...initial} exportedCurrentResult exportedThisSet onNextSet={onNextSet} />)
  fireEvent.click(screen.getByRole("button", { name: "다음 세트" }))
  expect(onNextSet).toHaveBeenCalledOnce()
  expect(screen.getByText("다운로드 요청 완료")).toBeTruthy()
})

it("revokes the continuation shortcut after an exported result changes", () => {
  const { rerender } = render(<ExportBar {...initial} exportedCurrentResult exportedThisSet />)
  rerender(<ExportBar {...initial} exportedCurrentResult={false} exportedThisSet />)
  expect(screen.getByText("변경됨 · 다시 내보내기")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "다음 세트" })).toBeNull()
})

it("locks export and continuation while another export is pending", () => {
  const onOpenExport = vi.fn()
  const onNextSet = vi.fn()
  render(
    <ExportBar
      {...initial}
      exportedCurrentResult
      exporting
      onNextSet={onNextSet}
      onOpenExport={onOpenExport}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "내보내기" }))
  fireEvent.click(screen.getByRole("button", { name: "다음 세트" }))
  expect(onOpenExport).not.toHaveBeenCalled()
  expect(onNextSet).not.toHaveBeenCalled()
  expect(screen.getByText("파일 생성 중")).toBeTruthy()
})

it("keeps a failed occupied slot separate from missing photographs", () => {
  render(<ExportBar {...initial} failedCount={1} disabled />)
  expect(screen.getByText("3장 정렬 · 분석 실패 1장 · 사진 없음 3개")).toBeTruthy()
  expect(screen.queryByText(/4개 뷰 미촬영/)).toBeNull()
})

it("disables the header new-set action while the workspace is busy", () => {
  const onNewSet = vi.fn()
  render(
    <WorkspaceCommandBar
      activity={{ kind: "idle", label: "입력 대기" }}
      disabled
      onNewSet={onNewSet}
      onOpenGuide={vi.fn()}
      privacyState="localReady"
      resetNeedsConfirmation={false}
      showReset
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "새로 시작" }))
  expect(onNewSet).not.toHaveBeenCalled()
})
