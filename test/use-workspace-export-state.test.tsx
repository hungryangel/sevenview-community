// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { type ReactNode, StrictMode } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { photoId } from "../src/domain/types"
import { useWorkspace } from "../src/product/use-workspace"

const { exportWorkspacePngs } = vi.hoisted(() => ({ exportWorkspacePngs: vi.fn() }))

vi.mock("../src/adapters/contact-sheet-canvas", () => ({ exportWorkspacePngs }))
vi.mock("../src/domain/exif-capture-time", () => ({
  cameraLabel: () => "테스트 카메라",
  readExifSummary: async () => ({}),
  summarizeFilesByCaptureTime: async (files: readonly File[]) =>
    files.map((file) => ({ file, summary: {} })),
}))
vi.mock("../src/services/analyze-local-files", () => ({
  analyzeBrowserFiles: async (files: readonly File[]) =>
    files.map((file, index) => ({
      decoded: { height: 1000, image: document.createElement("canvas"), width: 800 },
      file,
      kind: "ready" as const,
      pose: {
        anchor: { x: 0.5, y: 0.5 },
        bounds: { bottom: 0.8, left: 0.2, right: 0.8, top: 0.2 },
        confidence: 0.99,
        id: photoId(`export-state-${index}`),
        pitchScore: 0,
        rollDegrees: 0,
        yawScore: 0,
      },
    })),
}))

afterEach(() => {
  cleanup()
  exportWorkspacePngs.mockReset()
})

async function reviewedWorkspace() {
  const hook = renderHook(() => useWorkspace())
  await act(async () => {
    await hook.result.current.processFiles([
      new File(["fixture"], "fixture.png", { type: "image/png" }),
    ])
  })
  await act(async () => hook.result.current.startAnalysis())
  await waitFor(() => expect(hook.result.current.phase).toBe("review"))
  return hook
}

const strictWrapper = ({ children }: { readonly children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
)

it("treats selected but not yet analyzed files as unexported work", async () => {
  const hook = renderHook(() => useWorkspace())
  expect(hook.result.current.hasUnexportedChanges).toBe(false)

  await act(async () => {
    await hook.result.current.processFiles([
      new File(["fixture"], "pending-fixture.png", { type: "image/png" }),
    ])
  })

  expect(hook.result.current.phase).toBe("awaitingAnalysis")
  expect(hook.result.current.exportedCurrentResult).toBe(false)
  expect(hook.result.current.hasUnexportedChanges).toBe(true)
})

it("marks a successful export current under React StrictMode effect rehearsal", async () => {
  exportWorkspacePngs.mockResolvedValue({ contactSheetExported: true })
  const hook = renderHook(() => useWorkspace(), { wrapper: strictWrapper })
  await act(async () => {
    await hook.result.current.processFiles([
      new File(["fixture"], "strict-fixture.png", { type: "image/png" }),
    ])
  })
  await act(async () => hook.result.current.startAnalysis())
  await act(async () => hook.result.current.exportPng())

  expect(hook.result.current.exportedThisSet).toBe(true)
  expect(hook.result.current.exportedCurrentResult).toBe(true)
})

it("tracks whether the current reviewed result has unexported changes", async () => {
  exportWorkspacePngs.mockResolvedValue({ contactSheetExported: true })
  const hook = await reviewedWorkspace()
  expect(hook.result.current.hasUnexportedChanges).toBe(true)
  expect(hook.result.current.exportedCurrentResult).toBe(false)

  await act(async () => hook.result.current.exportPng())
  expect(hook.result.current.hasUnexportedChanges).toBe(false)
  expect(hook.result.current.exportedCurrentResult).toBe(true)

  act(() => hook.result.current.setSessionMemo("수정"))
  expect(hook.result.current.hasUnexportedChanges).toBe(true)
  expect(hook.result.current.exportedCurrentResult).toBe(false)

  await act(async () => hook.result.current.exportPng())
  expect(hook.result.current.exportedCurrentResult).toBe(true)
})

it("does not mark edits made during an export as exported by that older export", async () => {
  let finishExport: ((result: { readonly contactSheetExported: boolean }) => void) | undefined
  exportWorkspacePngs.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishExport = resolve
      }),
  )
  const hook = await reviewedWorkspace()

  let exporting: Promise<void> | undefined
  act(() => {
    exporting = hook.result.current.exportPng()
  })
  act(() => hook.result.current.setPatientLabel("변경"))
  await act(async () => {
    finishExport?.({ contactSheetExported: true })
    await exporting
  })

  expect(hook.result.current.exportedThisSet).toBe(true)
  expect(hook.result.current.exportedCurrentResult).toBe(false)
  expect(hook.result.current.hasUnexportedChanges).toBe(true)
})

it("ignores a successful export that resolves after the workspace was reset", async () => {
  let finishExport: ((result: { readonly contactSheetExported: boolean }) => void) | undefined
  exportWorkspacePngs.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishExport = resolve
      }),
  )
  const hook = await reviewedWorkspace()
  let exporting: Promise<void> | undefined
  act(() => {
    exporting = hook.result.current.exportPng()
  })
  act(() => hook.result.current.reset())
  await act(async () => {
    finishExport?.({ contactSheetExported: true })
    await exporting
  })

  expect(hook.result.current.phase).toBe("empty")
  expect(hook.result.current.exportedThisSet).toBe(false)
  expect(hook.result.current.exportedCurrentResult).toBe(false)
  expect(hook.result.current.hasUnexportedChanges).toBe(false)
})

it("invalidates a successful export after result, view, framing, or session changes", async () => {
  exportWorkspacePngs.mockResolvedValue({ contactSheetExported: true })
  const hook = await reviewedWorkspace()
  const exportCurrent = async () => {
    await act(async () => hook.result.current.exportPng())
    expect(hook.result.current.exportedCurrentResult).toBe(true)
  }

  await exportCurrent()
  const photo = hook.result.current.photos[0]
  expect(photo).toBeDefined()
  if (photo !== undefined) {
    act(() =>
      hook.result.current.updateAdjustment(photo.view, {
        ...photo.adjustment,
        panX: photo.adjustment.panX + 0.01,
      }),
    )
  }
  expect(hook.result.current.exportedCurrentResult).toBe(false)

  await exportCurrent()
  act(() => hook.result.current.changeFramingPreset("closeUp"))
  expect(hook.result.current.exportedCurrentResult).toBe(false)

  await exportCurrent()
  act(() => hook.result.current.changeViewSet("dentalSix"))
  expect(hook.result.current.exportedCurrentResult).toBe(false)

  await exportCurrent()
  act(() => hook.result.current.setSessionName("새 세션"))
  expect(hook.result.current.exportedCurrentResult).toBe(false)

  await exportCurrent()
  const selected = hook.result.current.photos[0]
  if (selected !== undefined) {
    act(() => hook.result.current.removePhotoToSpares(selected.view))
  }
  expect(hook.result.current.exportedCurrentResult).toBe(false)
  expect(hook.result.current.hasUnexportedChanges).toBe(true)
})

it("does not mark a failed export as successful", async () => {
  exportWorkspacePngs.mockRejectedValue(new Error("synthetic export failure"))
  const hook = await reviewedWorkspace()
  await act(async () => hook.result.current.exportPng())

  expect(hook.result.current.exportedThisSet).toBe(false)
  expect(hook.result.current.exportedCurrentResult).toBe(false)
  expect(hook.result.current.hasUnexportedChanges).toBe(true)
})
