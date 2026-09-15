// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NewSetDialog } from "../src/product/new-set-dialog"

afterEach(() => cleanup())

describe("NewSetDialog", () => {
  it("collects files without leaving the tool, and only enables sorting once photos exist", () => {
    const onAppendFiles = vi.fn()
    const onStart = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <NewSetDialog
        analyzing={false}
        message={null}
        onAppendFiles={onAppendFiles}
        onClose={onClose}
        onRemoveFile={() => undefined}
        onStart={onStart}
        open
        pendingFiles={[]}
        progress={0}
      />,
    )

    expect(screen.getByRole("dialog", { name: "새 세트 시작" })).toBeTruthy()
    const start = screen.getByRole("button", { name: "AI 자동 정렬" }) as HTMLButtonElement
    expect(start.disabled).toBe(true)

    const file = new File(["x"], "a.png", { type: "image/png" })
    fireEvent.change(screen.getByLabelText("새 세트 사진 선택"), { target: { files: [file] } })
    expect(onAppendFiles).toHaveBeenCalledWith([file])

    rerender(
      <NewSetDialog
        analyzing={false}
        message={null}
        onAppendFiles={onAppendFiles}
        onClose={onClose}
        onRemoveFile={() => undefined}
        onStart={onStart}
        open
        pendingFiles={[{ name: "a.png", previewUrl: "blob:a" }]}
        progress={0}
      />,
    )
    expect(screen.getByText("1장 선택됨")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "AI 자동 정렬" }))
    expect(onStart).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: "취소" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("locks closing while the new set is being analyzed and shows progress", () => {
    const onClose = vi.fn()
    render(
      <NewSetDialog
        analyzing
        message={null}
        onAppendFiles={() => undefined}
        onClose={onClose}
        onRemoveFile={() => undefined}
        onStart={() => undefined}
        open
        pendingFiles={[]}
        progress={42}
      />,
    )
    expect(screen.getByText("분석 중 42%")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "새 세트 닫기" }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
