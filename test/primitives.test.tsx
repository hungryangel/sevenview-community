// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Button } from "../src/ui/button"
import { DropZone } from "../src/ui/drop-zone"
import { InspectorControl } from "../src/ui/inspector-control"
import { Notice } from "../src/ui/notice"
import { PrivacyStatus } from "../src/ui/privacy-status"
import { ViewSlot } from "../src/ui/view-slot"

afterEach(cleanup)

describe("Button", () => {
  it("announces loading and prevents a duplicate action", () => {
    // Given: a primary export button in progress.
    render(
      <Button loading variant="primary">
        내보내기
      </Button>,
    )

    // When: its accessible state is inspected.
    const button = screen.getByRole("button", { name: "내보내기" })

    // Then: it is busy and disabled until the operation completes.
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(button.hasAttribute("disabled")).toBe(true)
  })
})

describe("DropZone", () => {
  it("offers a keyboard-accessible file input in addition to drag and drop", () => {
    // Given: an empty photo drop zone.
    const onFiles = vi.fn()
    render(<DropZone onFiles={onFiles} state="empty" />)
    const input = screen.getByLabelText("사진 파일 선택")
    const file = new File([new Uint8Array(8)], "front.jpg", { type: "image/jpeg" })

    // When: a user chooses a file through the native input.
    fireEvent.change(input, { target: { files: [file] } })

    // Then: the same file pipeline receives it.
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it("exposes validation progress and a true disabled input", () => {
    // Given: one active validation zone and one unavailable zone.
    const onFiles = vi.fn()
    const { rerender } = render(<DropZone onFiles={onFiles} state="validating" />)

    // When/Then: validation is announced as busy.
    expect(screen.getByRole("group").getAttribute("aria-busy")).toBe("true")

    // When: the zone becomes disabled.
    rerender(<DropZone disabled onFiles={onFiles} state="empty" />)

    // Then: the native file boundary is disabled as well.
    expect(screen.getByLabelText("사진 파일 선택").hasAttribute("disabled")).toBe(true)
  })
})

describe("PrivacyStatus", () => {
  it("states that image processing is local without relying on green alone", () => {
    // Given: the model is ready.
    render(<PrivacyStatus state="localReady" />)

    // When: the live status is read.
    const status = screen.getByRole("status")

    // Then: local processing and its full explanation are available without hover.
    expect(status.textContent).toContain("로컬 처리")
    const detailId = status.getAttribute("aria-describedby")
    expect(detailId).not.toBeNull()
    expect(document.getElementById(detailId ?? "")?.textContent).toContain("브라우저 밖으로")
  })

  it("keeps the outgoing state through the 120ms opacity crossfade", () => {
    // Given: a local-model start state and controlled transition time.
    vi.useFakeTimers()
    const { rerender } = render(<PrivacyStatus state="modelLoading" />)

    // When: the model becomes locally ready.
    rerender(<PrivacyStatus state="localReady" />)

    // Then: incoming and outgoing labels overlap only for the bounded crossfade.
    expect(screen.getByText("로컬 모델 준비 중")).not.toBeNull()
    expect(screen.getByRole("status").textContent).toContain("로컬 처리")
    act(() => vi.advanceTimersByTime(120))
    expect(screen.queryByText("로컬 모델 준비 중")).toBeNull()
    vi.useRealTimers()
  })
})

describe("Notice", () => {
  it("uses an alert role for recoverable errors", () => {
    // Given: a file validation error.
    render(
      <Notice kind="error" title="사진을 읽을 수 없습니다">
        JPG, PNG 또는 WebP 파일을 선택해 주세요.
      </Notice>,
    )

    // When: assistive technology discovers the message.
    const alert = screen.getByRole("alert")

    // Then: both the cause and recovery remain available.
    expect(alert.textContent).toContain("사진을 읽을 수 없습니다")
    expect(alert.textContent).toContain("JPG, PNG 또는 WebP")
  })

  it("supports dismissible and live-progress states", () => {
    // Given: a dismissible notice with bounded progress.
    const onDismiss = vi.fn()
    render(
      <Notice dismissible kind="info" onDismiss={onDismiss} progress={42} title="내보내는 중">
        표준 컨퍼런스 시트를 만들고 있습니다.
      </Notice>,
    )

    // When: a user dismisses the notice.
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }))

    // Then: dismissal is delivered and progress is machine-readable.
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42")
  })
})

describe("InspectorControl", () => {
  it("provides a labeled range, explicit step actions, and reset", () => {
    // Given: a changed crop-scale control.
    const onChange = vi.fn()
    const onReset = vi.fn()
    render(
      <InspectorControl
        defaultValue={100}
        label="얼굴 크기"
        max={130}
        min={70}
        onChange={onChange}
        onReset={onReset}
        step={1}
        unit="%"
        value={104}
      />,
    )

    // When: its accessible controls are inspected and used.
    const range = screen.getByRole("slider", { name: "얼굴 크기" })
    fireEvent.click(screen.getByRole("button", { name: "얼굴 크기 줄이기" }))
    fireEvent.click(screen.getByRole("button", { name: "얼굴 크기 기본값으로 재설정" }))

    // Then: value text and both actions are explicit.
    expect(range.getAttribute("aria-valuetext")).toBe("104%")
    expect(onChange).toHaveBeenCalledWith(103)
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})

describe("ViewSlot", () => {
  it("exposes its layout variant and keyboard reorder actions", () => {
    // Given: a selected filmstrip slot with reorder callbacks.
    const onMoveEarlier = vi.fn()
    render(
      <ViewSlot
        index={2}
        label="우측 45도"
        onMoveEarlier={onMoveEarlier}
        state="ready"
        variant="filmstrip"
      />,
    )

    // When: the reorder affordance reveals and uses the earlier action.
    fireEvent.click(screen.getByRole("button", { name: "우측 45도 순서 변경" }))
    fireEvent.click(screen.getByRole("button", { name: "우측 45도 앞 순서로 이동" }))

    // Then: the variant and reorder operation are available without drag.
    expect(document.querySelector(".view-slot-wrap--filmstrip")).not.toBeNull()
    expect(onMoveEarlier).toHaveBeenCalledTimes(1)
  })

  it("shows a manual assignment without any numeric confidence", () => {
    // Given: a recovery slot assigned by a reviewer after landmark detection failed.
    render(<ViewSlot assignmentMethod="manual" index={6} label="아래 (턱 밑)" state="ready" />)

    // When: its status text is read.

    // Then: the card identifies the manual decision without a percentage.
    expect(screen.getByText("수동")).toBeTruthy()
    expect(screen.queryByText(/\d+%/)).toBeNull()
  })

  it("uses the concept's automatic provenance label without a misleading percentage", () => {
    // Given: a successfully analyzed automatic assignment.
    render(<ViewSlot assignmentMethod="auto" index={1} label="정면" state="ready" />)

    // When: the ready metadata is read.

    // Then: the source is called automatic — 감지 수치는 뷰 확률로 오독되던
    // 표시라 슬롯에서 제거됐습니다.
    expect(screen.getByText("자동")).toBeTruthy()
    expect(screen.queryByText("정렬됨")).toBeNull()
    expect(screen.queryByText(/\d+%/)).toBeNull()
  })

  it("keeps the manual label when the assigned view also needs review", () => {
    // Given: a manually assigned photo whose pose still requires a human check.
    render(<ViewSlot assignmentMethod="manual" index={4} label="우측 측면" state="warning" />)

    // When: the warning status is presented.

    // Then: it preserves the manual provenance and never shows an automatic percentage.
    expect(screen.getByText("수동 · 검토 필요")).toBeTruthy()
    expect(screen.queryByText(/\d+%/)).toBeNull()
  })

  it("marks a manually adjusted tile so reviewers can spot touched photos in the grid", () => {
    // bee 2026-09-03: '✓ 자동 · 보정됨' 두 표기 대신 '수동보정' 하나 — 자동 문구와 확인 아이콘 자리를 대신한다.
    render(<ViewSlot adjusted assignmentMethod="auto" index={2} label="우측 45도" state="ready" />)

    expect(screen.getByText("수동보정")).toBeTruthy()
    expect(screen.queryByText("자동")).toBeNull()
    expect(screen.queryByText("보정됨")).toBeNull()
    expect(document.querySelector(".view-slot__meta svg")).toBeNull()
  })

  it("keeps the warning text ahead of the manual-adjustment label", () => {
    render(
      <ViewSlot
        adjusted
        assignmentMethod="auto"
        index={4}
        label="우측 측면"
        state="warning"
        statusText="각도 불일치"
      />,
    )

    expect(screen.getByText("각도 불일치")).toBeTruthy()
    expect(screen.getByText("수동보정")).toBeTruthy()
  })

  it("renders the per-photo recovery error supplied by analysis", () => {
    // Given: a photo that could not produce a face landmark result.
    render(
      <ViewSlot index={3} label="좌측 45도" state="error" statusText="얼굴을 찾지 못했습니다" />,
    )

    // When/Then: the actionable error is visible in that slot.
    expect(screen.getByText("얼굴을 찾지 못했습니다")).toBeTruthy()
  })
})

describe("PrivacyStatus activity", () => {
  it("shows the current activity while keeping the local-processing promise as the description", () => {
    const { container, rerender } = render(
      <PrivacyStatus activity={{ kind: "busy", label: "우측 측면 보정 중" }} state="localReady" />,
    )
    const status = container.querySelector(".privacy-status") as HTMLElement
    expect(status.textContent).toContain("우측 측면 보정 중")
    expect(status.textContent).toContain("사진 바이트는 이 브라우저 밖으로 전송되지 않습니다.")
    expect(status.className).toContain("privacy-status--busy")

    rerender(<PrivacyStatus activity={{ kind: "error", label: "분석 실패" }} state="localReady" />)
    expect(status.className).toContain("privacy-status--error")
    expect(status.getAttribute("aria-live")).toBe("assertive")
  })
})
