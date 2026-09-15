// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, expect, it } from "vitest"
import { ComparisonNewPairAction } from "../src/product/comparison-new-pair-action"
import { SevenViewApp } from "../src/product/sevenview-app"
import { WorkspaceCommandBar } from "../src/product/workspace-command-bar"
import { WorkspaceHeaderAction } from "../src/product/workspace-header-action"

afterEach(cleanup)

function ClinicalSession({ active }: { readonly active: boolean }) {
  const [count, setCount] = useState(1)
  return (
    <>
      <WorkspaceCommandBar
        active={active}
        activity={{ kind: "idle", label: "검토" }}
        embedded
        onNewSet={() => setCount(0)}
        onOpenGuide={() => undefined}
        privacyState="localReady"
        resetNeedsConfirmation
        showReset
      />
      <h1 id="seven-view-heading" tabIndex={-1}>
        임상 작업 {count}
      </h1>
    </>
  )
}

function PairSession({ active }: { readonly active: boolean }) {
  const [count, setCount] = useState(2)
  return (
    <>
      <WorkspaceHeaderAction active={active}>
        <ComparisonNewPairAction
          active={active}
          disabled={false}
          exported={false}
          onStartNew={() => setCount(0)}
        />
      </WorkspaceHeaderAction>
      <h1 id="comparison-heading" tabIndex={-1}>
        비교 작업 {count}
      </h1>
    </>
  )
}

it("keeps each reset and confirmation in its owner while showing only the active action in the shared header", () => {
  render(<SevenViewApp SevenViewSurface={ClinicalSession} ComparisonSurface={PairSession} />)
  const header = within(screen.getByRole("banner"))
  fireEvent.click(header.getByRole("button", { name: "새로 시작" }))
  expect(header.getByText("아직 내보내지 않았습니다")).toBeTruthy()
  fireEvent.click(header.getByRole("tab", { name: "치료 전후 비교" }))
  expect(header.queryByRole("button", { name: "새로 시작" })).toBeNull()
  fireEvent.click(header.getByRole("button", { name: "새 비교 시작" }))
  expect(header.getByRole("alertdialog", { name: "저장하지 않은 비교 지우기" })).toBeTruthy()
  fireEvent.click(header.getByRole("button", { name: "저장하지 않고 새 비교 시작" }))
  expect(screen.getByRole("heading", { name: "비교 작업 0" })).toBeTruthy()
  fireEvent.click(header.getByRole("tab", { name: "임상 사진 정렬" }))
  expect(header.queryByText("아직 내보내지 않았습니다")).toBeNull()
  expect(screen.getByRole("heading", { name: "임상 작업 1" })).toBeTruthy()
  fireEvent.click(header.getByRole("button", { name: "새로 시작" }))
  fireEvent.click(header.getByRole("button", { name: "새 세트 시작" }))
  expect(screen.getByRole("heading", { name: "임상 작업 0" })).toBeTruthy()
  expect(document.querySelector(".workspace-local-actions")).toBeNull()
})
