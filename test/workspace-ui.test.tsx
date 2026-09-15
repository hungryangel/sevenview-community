// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { photoId } from "../src/domain/types"
import { VIEW_SETS } from "../src/domain/view-set"
import type { WorkspacePhoto } from "../src/domain/workspace"
import { EmptyWorkspace } from "../src/product/empty-workspace"
import { ExportBar } from "../src/product/export-bar"
import { ExportDialog } from "../src/product/export-dialog"
import { InspectorPanel } from "../src/product/inspector-panel"
import { EMPTY_USAGE_LEDGER } from "../src/product/usage-ledger"
import { Workspace } from "../src/product/workspace"
import { WorkspaceCommandBar } from "../src/product/workspace-command-bar"

const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

afterEach(() => {
  cleanup()
  getContext.mockClear()
})

const reviewPhoto: WorkspacePhoto<HTMLCanvasElement> = {
  adjustment: { panX: 0, panY: 0, rotationDegrees: 0, scaleMultiplier: 1 },
  assignmentMethod: "auto",
  image: document.createElement("canvas"),
  pose: {
    anchor: { x: 0.5, y: 0.5 },
    bounds: { bottom: 0.85, left: 0.25, right: 0.75, top: 0.15 },
    confidence: 0.9,
    id: photoId("session-review-photo"),
    pitchScore: 0,
    rollDegrees: 0,
    yawScore: 0,
  },
  sourceSize: { height: 1000, width: 800 },
  view: "front",
}

describe("Workspace", () => {
  it("can embed its session without duplicating shell chrome", () => {
    const { container } = render(<Workspace active embedded />)

    expect(container.querySelector(".workspace-command-bar")).toBeNull()
    expect(container.querySelector(".app-footer")).toBeNull()
    expect(screen.getByRole("heading", { name: "사진 접수" }).id).toBe("seven-view-heading")
  })

  it("starts with a local-first seven-photo input without an unlicensed sample path", () => {
    render(<Workspace />)

    expect(screen.getByRole("heading", { name: "사진 접수" })).toBeTruthy()
    expect(screen.getByLabelText("사진 파일 선택")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "합성 샘플로 보기" })).toBeNull()
    expect(screen.getByText("사진 대기")).toBeTruthy()
    expect(screen.getByText("사진 바이트는 이 브라우저 밖으로 전송되지 않습니다.")).toBeTruthy()
  })

  it("credits the maker with copyright, version, and a kakao contact in the footer", async () => {
    const { APP_VERSION, KAKAO_CHAT_URL } = await import("../src/product/app-footer")
    render(<Workspace />)

    expect(screen.getByAltText("VELNOC")).toBeTruthy()
    expect(screen.getByText((text) => text.includes(`SevenView v${APP_VERSION}`))).toBeTruthy()
    expect(screen.getByText((text) => text.includes("©") && text.includes("VELNOC"))).toBeTruthy()
    expect(screen.getByRole("link", { name: "신고 · 기능 문의" }).getAttribute("href")).toBe(
      KAKAO_CHAT_URL,
    )
  })

  it("keeps session, export, and draft-preset controls local to the review UI", () => {
    render(
      <>
        <InspectorPanel
          diagnostics={[]}
          framing={FRAMING_PRESETS.clinicalStandard}
          hasLateralityConflict={false}
          onAssignView={() => undefined}
          onDismissDiagnostic={() => undefined}
          onRemoveToSpares={() => undefined}
          onReplace={() => undefined}
          onReset={() => undefined}
          onResetAll={() => undefined}
          onSessionMemoChange={() => undefined}
          onShowCropGuide={() => undefined}
          onShowCenterGuide={() => undefined}
          onShowEyeGuide={() => undefined}
          onSwapLaterality={() => undefined}
          onUpdate={() => undefined}
          photo={reviewPhoto}
          poseMismatch={null}
          sessionMemo=""
          suggestedView={null}
          views={VIEW_SETS.standardSeven.views}
          showCropGuide
          showCenterGuide
          showEyeGuide
        />
        <ExportBar
          disabled={false}
          exportCount={0}
          sessionPhotoCount={7}
          totalViews={7}
          usage={EMPTY_USAGE_LEDGER}
          onOpenExport={() => undefined}
          patientLabel=""
          photoCount={7}
          reviewCount={0}
        />
      </>,
    )

    // 내보내기는 버튼 하나 — 세션명·환자 라벨·출력 선택은 대화상자에서(2026-09-03).
    expect(screen.getByRole("button", { name: "내보내기" })).toBeTruthy()
    // 자동 안내가 사라진 뒤에도 안전 확인 문구는 내보내기 옆에 남는다.
    expect(screen.getByText("내보내기 전에 방향과 크롭을 확인하세요")).toBeTruthy()
    expect(screen.getByText("자동 제안입니다. 방향과 크롭을 확인하세요.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "예비로 빼기" })).toBeTruthy()
    expect(screen.getByText(/90~110%/)).toBeTruthy()
    expect(screen.queryByRole("checkbox", { name: /컨택트 시트 PNG/ })).toBeNull()
    expect(screen.getByText("프로토콜 프리셋")).toBeTruthy()
    expect(screen.getByText("Standard 7 View (초안)")).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: "눈높이 기준선" })).toBeTruthy()
    expect(screen.getByLabelText("세션 메모")).toBeTruthy()
    expect(screen.getByText("권장")).toBeTruthy()
    expect(screen.getByText("미세 조정")).toBeTruthy()
    expect(screen.getByRole("button", { name: "수평 회전 미세 조정 -0.1°" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "수평 회전 미세 조정 +0.1°" })).toBeTruthy()
  })

  it("replaces the selected view from a dropped file and removes it to spares", () => {
    const onReplace = vi.fn()
    const onRemoveToSpares = vi.fn()
    const { container } = render(
      <InspectorPanel
        diagnostics={[]}
        framing={FRAMING_PRESETS.clinicalStandard}
        hasLateralityConflict={false}
        onAssignView={() => undefined}
        onDismissDiagnostic={() => undefined}
        onRemoveToSpares={onRemoveToSpares}
        onReplace={onReplace}
        onReset={() => undefined}
        onResetAll={() => undefined}
        onSessionMemoChange={() => undefined}
        onShowCropGuide={() => undefined}
        onShowCenterGuide={() => undefined}
        onShowEyeGuide={() => undefined}
        onSwapLaterality={() => undefined}
        onUpdate={() => undefined}
        photo={reviewPhoto}
        poseMismatch={null}
        sessionMemo=""
        suggestedView={null}
        views={VIEW_SETS.standardSeven.views}
        showCropGuide
        showCenterGuide
        showEyeGuide
      />,
    )

    // 사진 교체는 파일 선택뿐 아니라 미리보기 드롭으로도(2026-09-02).
    const preview = container.querySelector(".inspector-panel__preview") as HTMLElement
    const file = new File(["x"], "replacement.png", { type: "image/png" })
    fireEvent.drop(preview, { dataTransfer: { files: [file], types: ["Files"] } })
    expect(onReplace).toHaveBeenCalledWith(file)

    fireEvent.click(screen.getByRole("button", { name: "예비로 빼기" }))
    expect(onRemoveToSpares).toHaveBeenCalledTimes(1)
  })

  it("warns about a manual angle mismatch with the measured reason and a one-click fix", () => {
    const onAssignView = vi.fn()
    render(
      <InspectorPanel
        diagnostics={[]}
        framing={FRAMING_PRESETS.clinicalStandard}
        hasLateralityConflict={false}
        onAssignView={onAssignView}
        onDismissDiagnostic={() => undefined}
        onRemoveToSpares={() => undefined}
        onReplace={() => undefined}
        onReset={() => undefined}
        onResetAll={() => undefined}
        onSessionMemoChange={() => undefined}
        onShowCropGuide={() => undefined}
        onShowCenterGuide={() => undefined}
        onShowEyeGuide={() => undefined}
        onSwapLaterality={() => undefined}
        onUpdate={() => undefined}
        photo={{ ...reviewPhoto, assignmentMethod: "manual", view: "rightProfile" }}
        poseMismatch={{ kind: "not_lateral" }}
        sessionMemo=""
        suggestedView="crownDown"
        views={VIEW_SETS.standardSeven.views}
        showCropGuide
        showCenterGuide
        showEyeGuide
      />,
    )

    expect(screen.getByText("이 사진은 '우측 측면' 각도로 보이지 않습니다.")).toBeTruthy()
    expect(screen.getByText(/측정값 기준으로는 '위 \(정수리\)'에 가깝습니다/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "'위 (정수리)' 뷰로 보내기" }))
    expect(onAssignView).toHaveBeenCalledWith("crownDown")
  })
})

describe("explicit automatic sorting", () => {
  it("shows the approved local-only analysis action after seven files are ready", () => {
    render(
      <EmptyWorkspace
        compact={false}
        dropZoneState="empty"
        message={null}
        onAppendFiles={() => undefined}
        onFiles={() => undefined}
        onOpenGuide={() => undefined}
        onRemovePendingFile={() => undefined}
        onStartAnalysis={() => undefined}
        pendingFiles={[
          { name: "1.jpg", previewUrl: "blob:1" },
          { name: "2.jpg", previewUrl: "blob:2" },
          { name: "3.jpg", previewUrl: "blob:3" },
          { name: "4.jpg", previewUrl: "blob:4" },
          { name: "5.jpg", previewUrl: "blob:5" },
          { name: "6.jpg", previewUrl: "blob:6" },
          { name: "7.jpg", previewUrl: "blob:7" },
        ]}
        phase="awaitingAnalysis"
        progress={0}
        receivingDrop={false}
      />,
    )

    expect(screen.getByText("분석 대기")).toBeTruthy()
    expect(screen.getByText("원본 7장을 준비했습니다")).toBeTruthy()
    expect(screen.getByRole("img", { name: "1번 원본 썸네일" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "1번 사진 빼기" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "사진 추가 (7/12)" })).toBeTruthy()
    expect(screen.getByText("사진을 이 화면 아무 데나 끌어다 놓아도 추가됩니다")).toBeTruthy()
    expect(
      screen.getByText("정렬이 끝나면 내보내기 전에 방향과 크롭을 한 번 확인할 수 있습니다"),
    ).toBeTruthy()
    // 실행 버튼은 헤더가 아니라 사진 바로 아래(흐름 안)에 있다(2026-09-01 이동).
    expect(screen.getByRole("button", { name: "AI 자동 정렬" })).toBeTruthy()
  })

  it("keeps the header free of the run action", () => {
    render(
      <WorkspaceCommandBar
        onOpenGuide={() => undefined}
        onNewSet={() => undefined}
        activity={{ kind: "idle", label: "입력 대기 · 정면" }}
        privacyState="localReady"
        resetNeedsConfirmation={false}
        showReset={false}
      />,
    )

    expect(screen.queryByRole("button", { name: "AI 자동 정렬" })).toBeNull()
  })
})

describe("unexported-set reset confirmation", () => {
  const renderResetBar = (resetNeedsConfirmation: boolean, onNewSet: () => void) =>
    render(
      <WorkspaceCommandBar
        onOpenGuide={() => undefined}
        onNewSet={onNewSet}
        activity={{ kind: "idle", label: "입력 대기 · 정면" }}
        privacyState="localReady"
        resetNeedsConfirmation={resetNeedsConfirmation}
        showReset
      />,
    )

  it("asks before starting a new set over an unexported one and proceeds only on explicit confirm", () => {
    const onNewSet = vi.fn()
    renderResetBar(true, onNewSet)

    fireEvent.click(screen.getByRole("button", { name: "새로 시작" }))
    expect(onNewSet).not.toHaveBeenCalled()
    expect(screen.getByText("아직 내보내지 않았습니다")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "계속 작업" }))
    expect(screen.queryByText("아직 내보내지 않았습니다")).toBeNull()
    expect(onNewSet).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "새로 시작" }))
    fireEvent.click(screen.getByRole("button", { name: "새 세트 시작" }))
    expect(onNewSet).toHaveBeenCalledTimes(1)
  })

  it("opens the new-set dialog immediately once the current set was exported", () => {
    const onNewSet = vi.fn()
    renderResetBar(false, onNewSet)

    fireEvent.click(screen.getByRole("button", { name: "새로 시작" }))
    expect(onNewSet).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("아직 내보내지 않았습니다")).toBeNull()
  })
})

describe("export dialog", () => {
  const renderDialog = (overrides: Partial<Parameters<typeof ExportDialog>[0]> = {}) => {
    const props = {
      exportSelection: { contactSheet: true, individualPngs: false, pdf: false, pptx: false },
      exporting: false,
      onClose: vi.fn(),
      onExport: vi.fn(),
      onExportSelectionChange: vi.fn(),
      onPatientLabelChange: vi.fn(),
      onSessionNameChange: vi.fn(),
      open: true,
      patientLabel: "",
      photoCount: 7,
      sessionName: "2026-08-31_0905",
      ...overrides,
    }
    render(<ExportDialog {...props} />)
    return props
  }

  it("gathers session, label, outputs, and the resulting filename in one place, then saves", () => {
    const props = renderDialog({ patientLabel: "김/테스트" })

    expect(screen.getByRole("dialog", { name: "내보내기" })).toBeTruthy()
    expect(screen.getByLabelText("세션명")).toBeTruthy()
    expect(screen.getByLabelText("환자 라벨 (선택)")).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: /컨택트 시트 PNG/ })).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: /컨택트 시트 PDF/ })).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: /컨택트 시트 PPT/ })).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: "개별 7장 PNG" })).toBeTruthy()
    expect(screen.getByText("2026-08-31_0905_김-테스트_contact-sheet.png")).toBeTruthy()
    expect(screen.getByText("다운로드 폴더의 클라우드 동기화 여부를 확인하세요")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "저장하기" }))
    expect(props.onExport).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it("switches the filename preview to the ZIP bundle and blocks saving with nothing selected", () => {
    renderDialog({
      exportSelection: { contactSheet: true, individualPngs: true, pdf: false, pptx: false },
    })
    expect(screen.getByText("2026-08-31_0905_sevenview.zip")).toBeTruthy()
    cleanup()

    // PDF만 고르면 PDF 파일 하나, PDF+PPT처럼 둘 이상이면 ZIP.
    renderDialog({
      exportSelection: { contactSheet: false, individualPngs: false, pdf: true, pptx: false },
    })
    expect(screen.getByText("2026-08-31_0905_contact-sheet.pdf")).toBeTruthy()
    cleanup()
    renderDialog({
      exportSelection: { contactSheet: false, individualPngs: false, pdf: true, pptx: true },
    })
    expect(screen.getByText("2026-08-31_0905_sevenview.zip")).toBeTruthy()
    cleanup()

    renderDialog({
      exportSelection: { contactSheet: false, individualPngs: false, pdf: false, pptx: false },
    })
    expect(screen.getByText("출력을 하나 이상 선택하세요")).toBeTruthy()
    expect((screen.getByRole("button", { name: "저장하기" }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
