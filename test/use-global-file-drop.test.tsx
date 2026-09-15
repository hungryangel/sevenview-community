// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useGlobalFileDrop } from "../src/product/use-global-file-drop"

afterEach(cleanup)

function Harness({
  active = true,
  accepting,
  onFiles,
}: {
  readonly active?: boolean
  readonly accepting: boolean
  readonly onFiles: (files: readonly File[]) => void
}) {
  const dragging = useGlobalFileDrop({ accepting, active, onFiles })
  return (
    <div>
      <output>{dragging ? "dragging" : "idle"}</output>
      <section
        aria-label="local target"
        data-testid="local-target"
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
      />
    </div>
  )
}

const fileDrag = (files: readonly File[] = []) => ({
  dataTransfer: { files, types: ["Files"] },
})

describe("useGlobalFileDrop", () => {
  it("accepts a window-level drop and hands the files over", () => {
    const onFiles = vi.fn()
    render(<Harness accepting onFiles={onFiles} />)

    fireEvent.dragOver(window, fileDrag())
    expect(screen.getByText("dragging")).toBeTruthy()

    const file = new File(["x"], "extra.png", { type: "image/png" })
    fireEvent.drop(window, fileDrag([file]))
    expect(onFiles).toHaveBeenCalledWith([file])
    expect(screen.getByText("idle")).toBeTruthy()
  })

  it("blocks the browser navigation hazard but takes nothing while not accepting", () => {
    const onFiles = vi.fn()
    render(<Harness accepting={false} onFiles={onFiles} />)

    fireEvent.dragOver(window, fileDrag())
    expect(screen.getByText("idle")).toBeTruthy()

    const dropEvent = fireEvent.drop(
      window,
      fileDrag([new File(["x"], "extra.png", { type: "image/png" })]),
    )
    expect(onFiles).not.toHaveBeenCalled()
    // preventDefault는 걸린다(파일로 이동해 세션을 날리는 사고 방지).
    expect(dropEvent).toBe(false)
  })

  it("ignores non-file drags entirely", () => {
    const onFiles = vi.fn()
    render(<Harness accepting onFiles={onFiles} />)

    fireEvent.dragOver(window, { dataTransfer: { files: [], types: ["text/plain"] } })
    expect(screen.getByText("idle")).toBeTruthy()

    fireEvent.drop(window, { dataTransfer: { files: [], types: ["text/plain"] } })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it("stays out of the way when a dedicated drop target already handled the event", () => {
    const onFiles = vi.fn()
    render(<Harness accepting onFiles={onFiles} />)

    const event = new Event("drop", { bubbles: true, cancelable: true }) as unknown as DragEvent
    Object.assign(event, {
      dataTransfer: { files: [new File(["x"], "a.png", { type: "image/png" })], types: ["Files"] },
    })
    event.preventDefault()
    window.dispatchEvent(event)
    expect(onFiles).not.toHaveBeenCalled()
  })

  it("does not overwrite a dedicated target's accepted bubbling dragover", () => {
    const onFiles = vi.fn()
    render(<Harness accepting={false} onFiles={onFiles} />)
    const dataTransfer = { dropEffect: "none", files: [], types: ["Files"] }

    const accepted = fireEvent.dragOver(screen.getByTestId("local-target"), { dataTransfer })

    expect(accepted).toBe(false)
    expect(dataTransfer.dropEffect).toBe("copy")
  })

  it("installs no window drop ownership while inactive", () => {
    const onFiles = vi.fn()
    render(<Harness accepting active={false} onFiles={onFiles} />)
    const event = new Event("drop", { bubbles: true, cancelable: true }) as unknown as DragEvent
    Object.assign(event, { dataTransfer: fileDrag([new File(["x"], "inactive.png")]).dataTransfer })

    expect(window.dispatchEvent(event)).toBe(true)
    expect(onFiles).not.toHaveBeenCalled()
  })
})
