// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { createComparisonExportSettings } from "../src/domain/comparison-export"
import {
  ComparisonExportDialog,
  type ComparisonExportDialogProps,
} from "../src/product/comparison-export-dialog"

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "")
  this.querySelector<HTMLInputElement>("input")?.focus()
})
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open")
  this.dispatchEvent(new Event("close"))
})

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: showModal,
  })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: close })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
afterAll(() => {
  for (const [name, descriptor] of [
    ["showModal", originalShowModal],
    ["close", originalClose],
  ] as const) {
    if (descriptor === undefined) Reflect.deleteProperty(HTMLDialogElement.prototype, name)
    else Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
  }
})

function renderDialog(
  options: Partial<
    Pick<ComparisonExportDialogProps, "settings" | "busy" | "message" | "open">
  > = {},
) {
  const onChange = vi.fn()
  const onClose = vi.fn()
  const onExport = vi.fn()
  function Harness() {
    const [settings, setSettings] = useState(
      options.settings ?? createComparisonExportSettings("비교 세션"),
    )
    const [open, setOpen] = useState(options.open ?? true)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          비교 이미지 저장
        </button>
        <ComparisonExportDialog
          open={open}
          busy={options.busy ?? false}
          message={options.message ?? null}
          settings={settings}
          onChange={(value) => {
            onChange(value)
            setSettings(value)
          }}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          onExport={onExport}
        />
      </>
    )
  }
  render(<Harness />)
  return { onChange, onClose, onExport }
}

describe("comparison export dialog", () => {
  it("opens a native modal when comparison saving is requested", () => {
    // Given: the dialog starts closed.
    renderDialog({ open: false })
    const trigger = screen.getByRole("button", { name: "비교 이미지 저장" })
    // When: the user opens export options.
    fireEvent.click(trigger)
    // Then: the named native dialog opens once with the PNG preview.
    expect(screen.getByRole("dialog", { name: "비교 저장 옵션" })).toBeTruthy()
    expect(showModal).toHaveBeenCalledTimes(1)
    expect(screen.getByText("비교 세션_before-after.png")).toBeTruthy()
  })

  it("blocks saving when the final selected format is cleared", () => {
    // Given: only paired PNG is initially selected.
    const fixture = renderDialog()
    // When: that checkbox is cleared.
    fireEvent.click(screen.getByRole("checkbox", { name: "비교 PNG" }))
    // Then: the save control is disabled and no export starts.
    expect(screen.getByRole("button", { name: "비교 파일 저장" }).matches(":disabled")).toBe(true)
    expect(fixture.onChange).toHaveBeenLastCalledWith({
      sessionName: "비교 세션",
      order: "beforeAfter",
      selection: { png: false, individualPngs: false, pdf: false, pptx: false, html: false },
    })
    expect(fixture.onExport).not.toHaveBeenCalled()
  })

  it.each(["개별 PNG", "비교 PDF", "비교 PPTX", "설명용 HTML"])(
    "previews one ZIP when %s joins the default PNG",
    (label) => {
      // Given: default paired PNG is selected.
      renderDialog()
      // When: another format is selected.
      fireEvent.click(screen.getByRole("checkbox", { name: label }))
      // Then: exactly one bundle filename is previewed without closing the modal.
      expect(screen.getByText("비교 세션_before-after.zip")).toBeTruthy()
      expect(screen.getByRole("dialog", { name: "비교 저장 옵션" })).toBeTruthy()
    },
  )

  it("shows the offline HTML purpose and photo privacy notice only when selected", () => {
    // Given: the HTML output starts disabled.
    renderDialog()
    expect(screen.queryByText("HTML 파일에는 두 사진이 포함됩니다.")).toBeNull()
    // When: the operator selects the interactive explanation.
    fireEvent.click(screen.getByRole("checkbox", { name: "설명용 HTML" }))
    // Then: its offline slider/logo purpose and concise privacy notice are visible.
    expect(screen.getByText("오프라인 슬라이더 · VELNOC 로고")).toBeTruthy()
    expect(screen.getByText("HTML 파일에는 두 사진이 포함됩니다.")).toBeTruthy()
  })

  it("updates the safe filename when the session name is edited", () => {
    // Given: open export settings with reversed presentation order.
    const settings = {
      ...createComparisonExportSettings("원래 이름"),
      order: "afterBefore",
    } as const
    const fixture = renderDialog({ settings })
    // When: the session name changes.
    fireEvent.change(screen.getByRole("textbox", { name: "세션명" }), {
      target: { value: "회의/비교: 9" },
    })
    // Then: only the name changes and the actual sanitized download name is shown.
    expect(fixture.onChange).toHaveBeenLastCalledWith({ ...settings, sessionName: "회의/비교: 9" })
    expect(screen.getByText("회의-비교- 9_before-after.png")).toBeTruthy()
  })

  it("starts export while keeping the dialog open for progress and retry", () => {
    // Given: a valid output selection.
    const fixture = renderDialog()
    // When: the user confirms saving.
    fireEvent.click(screen.getByRole("button", { name: "비교 파일 저장" }))
    // Then: export runs once without closing the modal.
    expect(fixture.onExport).toHaveBeenCalledTimes(1)
    expect(fixture.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "비교 저장 옵션" })).toBeTruthy()
  })

  it("locks editing and prevents Escape when an export is busy", () => {
    // Given: an active export.
    const fixture = renderDialog({ busy: true })
    const dialog = screen.getByRole("dialog", { name: "비교 저장 옵션" })
    const cancel = new Event("cancel", { cancelable: true })
    // When: Escape requests native cancellation.
    fireEvent(dialog, cancel)
    // Then: cancellation is prevented and every mutation/close/save control remains locked.
    expect(cancel.defaultPrevented).toBe(true)
    for (const control of [
      ...screen.getAllByRole("checkbox"),
      screen.getByRole("textbox"),
      screen.getByRole("button", { name: "취소" }),
      screen.getByRole("button", { name: "비교 저장 옵션 닫기" }),
      screen.getByRole("button", { name: "비교 파일 저장" }),
    ]) {
      expect(control.matches(":disabled")).toBe(true)
    }
    expect(fixture.onClose).not.toHaveBeenCalled()
  })

  it.each(["취소", "비교 저장 옵션 닫기", "Escape"])(
    "returns focus to the opener when closed using %s",
    (action) => {
      // Given: the modal was opened from a focused trigger.
      const fixture = renderDialog({ open: false })
      const trigger = screen.getByRole("button", { name: "비교 이미지 저장" })
      trigger.focus()
      fireEvent.click(trigger)
      // When: the chosen close action is requested.
      if (action === "Escape")
        fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }))
      else fireEvent.click(screen.getByRole("button", { name: action }))
      // Then: the dialog closes once and restores trigger focus.
      expect(fixture.onClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(document.activeElement).toBe(trigger)
    },
  )

  it("announces the current failure when an export message is supplied", () => {
    // Given: a failed export leaves its message available.
    const message = "비교 파일을 저장하지 못했습니다."
    // When: options are rendered with that message.
    renderDialog({ message })
    // Then: it is readable in a polite live region alongside retry controls.
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.textContent).toBe(message)
    expect(screen.getByRole("button", { name: "비교 파일 저장" }).matches(":disabled")).toBe(false)
  })
})
