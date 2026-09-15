// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { photoId } from "../src/domain/types"
import { useWorkspace } from "../src/product/use-workspace"

const { analyzeBrowserFiles, exportWorkspacePngs } = vi.hoisted(() => ({
  analyzeBrowserFiles: vi.fn(),
  exportWorkspacePngs: vi.fn(),
}))

vi.mock("../src/services/analyze-local-files", () => ({ analyzeBrowserFiles }))
vi.mock("../src/adapters/contact-sheet-canvas", () => ({ exportWorkspacePngs }))
vi.mock("../src/domain/exif-capture-time", () => ({
  cameraLabel: () => "샘플",
  readExifSummary: async () => ({}),
  summarizeFilesByCaptureTime: async (files: readonly File[]) =>
    files.map((file) => ({ file, summary: {} })),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it("retains the exported set while the next batch is pending and when its engine fails", async () => {
  const original = new File(["old"], "old.png", { type: "image/png" })
  analyzeBrowserFiles.mockResolvedValueOnce([
    {
      decoded: { height: 1000, image: document.createElement("canvas"), width: 800 },
      file: original,
      kind: "ready",
      pose: {
        anchor: { x: 0.5, y: 0.5 },
        bounds: { bottom: 0.8, left: 0.2, right: 0.8, top: 0.2 },
        confidence: 0.99,
        id: photoId("old-set-photo"),
        pitchScore: 0,
        rollDegrees: 0,
        yawScore: 0,
      },
    },
  ])
  exportWorkspacePngs.mockResolvedValueOnce({ contactSheetExported: true })
  const { result } = renderHook(() => useWorkspace())
  await act(async () => result.current.processFiles([original]))
  await act(async () => result.current.startAnalysis())
  act(() => result.current.setSessionName("원래 세트"))
  await act(async () => result.current.exportPng())
  expect(result.current.exportedCurrentResult).toBe(true)
  const oldPhotos = result.current.photos

  await act(async () => {
    result.current.appendPendingFiles([new File(["next"], "next.png", { type: "image/png" })])
  })
  let rejectBatch: (error: Error) => void = () => undefined
  const pending = new Promise<never>((_resolve, reject) => {
    rejectBatch = reject
  })
  analyzeBrowserFiles.mockReturnValueOnce(pending)
  let operation: Promise<boolean> = Promise.resolve(false)
  await act(async () => {
    operation = result.current.startNewSet()
  })
  await waitFor(() => expect(analyzeBrowserFiles).toHaveBeenCalledTimes(2))
  expect(result.current.newSetAnalyzing).toBe(true)
  expect(result.current.photos).toBe(oldPhotos)
  expect(result.current.sessionName).toBe("원래 세트")

  await act(async () => {
    rejectBatch(new Error("test engine unavailable"))
    expect(await operation).toBe(false)
  })
  expect(result.current.newSetAnalyzing).toBe(false)
  expect(result.current.photos).toBe(oldPhotos)
  expect(result.current.sessionName).toBe("원래 세트")
  expect(result.current.exportedCurrentResult).toBe(true)
  expect(result.current.pendingFiles).toHaveLength(1)
  expect(result.current.message?.kind).toBe("error")
})
