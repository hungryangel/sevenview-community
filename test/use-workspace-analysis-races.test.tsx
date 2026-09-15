// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { photoId } from "../src/domain/types"
import { useWorkspace } from "../src/product/use-workspace"

const { analyzeBrowserFiles, releaseImage, releasePreviewUrl } = vi.hoisted(() => ({
  analyzeBrowserFiles: vi.fn(),
  releaseImage: vi.fn(),
  releasePreviewUrl: vi.fn(),
}))

vi.mock("../src/services/analyze-local-files", () => ({ analyzeBrowserFiles }))
vi.mock("../src/adapters/image-resource", () => ({ releaseImage, releasePreviewUrl }))
vi.mock("../src/adapters/contact-sheet-canvas", () => ({ exportWorkspacePngs: vi.fn() }))
vi.mock("../src/domain/exif-capture-time", () => ({
  cameraLabel: () => "테스트",
  readExifSummary: async () => ({}),
  summarizeFilesByCaptureTime: async (files: readonly File[]) =>
    files.map((file) => ({ file, summary: {} })),
}))

function ready(file: File, id: string) {
  return {
    decoded: { height: 1000, image: document.createElement("canvas"), width: 800 },
    file,
    kind: "ready" as const,
    pose: {
      anchor: { x: 0.5, y: 0.5 },
      bounds: { bottom: 0.8, left: 0.2, right: 0.8, top: 0.2 },
      confidence: 0.99,
      id: photoId(id),
      pitchScore: 0,
      registrationAnchors: {
        noseTip: { x: 0.5, y: 0.55 },
        screenLeftEye: { x: 0.35, y: 0.4 },
        screenRightEye: { x: 0.65, y: 0.4 },
      },
      rollDegrees: 0,
      yawScore: 0,
    },
  }
}

function failed(file: File, image = document.createElement("canvas")) {
  return {
    code: "no_face" as const,
    decoded: { height: 1000, image, width: 800 },
    file,
    kind: "error" as const,
  }
}

beforeEach(() => {
  let url = 0
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => `blob:test-${++url}`,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  analyzeBrowserFiles.mockReset()
  releaseImage.mockReset()
  releasePreviewUrl.mockReset()
})

it("restores all three review guides when the workspace is reset", () => {
  // Given: an operator has hidden all screen-only review guides.
  const hook = renderHook(() => useWorkspace())
  act(() => {
    hook.result.current.setShowCropGuide(false)
    hook.result.current.setShowCenterGuide(false)
    hook.result.current.setShowEyeGuide(false)
  })
  expect(hook.result.current.showCropGuide).toBe(false)
  // When: a new session is started through the workspace reset action.
  act(() => hook.result.current.reset())
  // Then: all three guides return to their default visible state.
  expect([
    hook.result.current.showCropGuide,
    hook.result.current.showCenterGuide,
    hook.result.current.showEyeGuide,
  ]).toEqual([true, true, true])
})

it("restores all three review guides when a new analysis publishes its result", async () => {
  // Given: the previous result was reviewed with all guides hidden.
  const previous = ready(new File(["previous"], "previous.png", { type: "image/png" }), "previous")
  const next = ready(new File(["next"], "next.png", { type: "image/png" }), "next")
  analyzeBrowserFiles.mockResolvedValueOnce([previous]).mockResolvedValueOnce([next])
  const hook = renderHook(() => useWorkspace())
  await act(async () => hook.result.current.processFiles([previous.file]))
  await act(async () => hook.result.current.startAnalysis())
  act(() => {
    hook.result.current.setShowCropGuide(false)
    hook.result.current.setShowCenterGuide(false)
    hook.result.current.setShowEyeGuide(false)
  })
  await act(async () => hook.result.current.processFiles([next.file]))
  expect(hook.result.current.showCropGuide).toBe(false)
  // When: analysis of the next photo set completes successfully.
  await act(async () => hook.result.current.startAnalysis())
  // Then: the new review result starts with every screen guide visible.
  expect(hook.result.current.photos[0]?.pose.id).toBe("next")
  expect([
    hook.result.current.showCropGuide,
    hook.result.current.showCenterGuide,
    hook.result.current.showEyeGuide,
  ]).toEqual([true, true, true])
})

it("keeps original previews when the current run is cancelled", async () => {
  analyzeBrowserFiles.mockImplementation(
    (_files: readonly File[], _progress: unknown, runtime: { readonly signal?: AbortSignal }) =>
      new Promise((_, reject) => {
        runtime.signal?.addEventListener("abort", () => reject(runtime.signal?.reason), {
          once: true,
        })
      }),
  )
  const hook = renderHook(() => useWorkspace())
  await act(async () =>
    hook.result.current.processFiles([new File(["a"], "a.png", { type: "image/png" })]),
  )
  const preview = hook.result.current.pendingFiles[0]?.previewUrl
  let running: Promise<void> | undefined
  act(() => {
    running = hook.result.current.startAnalysis()
  })
  await waitFor(() => expect(hook.result.current.phase).toBe("analyzing"))

  act(() => hook.result.current.cancelAnalysis())
  await act(async () => running)

  expect(hook.result.current.phase).toBe("awaitingAnalysis")
  expect(hook.result.current.pendingFiles[0]?.previewUrl).toBe(preview)
  expect(hook.result.current.analysisJourney.kind).toBe("cancelled")
})

it("lets only the newest generation publish when completions arrive in inverse order", async () => {
  const completions: Array<(value: readonly ReturnType<typeof ready>[]) => void> = []
  analyzeBrowserFiles.mockImplementation(
    () =>
      new Promise((resolve) => {
        completions.push(resolve)
      }),
  )
  const hook = renderHook(() => useWorkspace())
  await act(async () =>
    hook.result.current.processFiles([new File(["old"], "old.png", { type: "image/png" })]),
  )
  let oldRun: Promise<void> | undefined
  act(() => {
    oldRun = hook.result.current.startAnalysis()
  })
  await waitFor(() => expect(completions).toHaveLength(1))
  await act(async () =>
    hook.result.current.processFiles([new File(["new"], "new.png", { type: "image/png" })]),
  )
  let newRun: Promise<void> | undefined
  act(() => {
    newRun = hook.result.current.startAnalysis()
  })
  await waitFor(() => expect(completions).toHaveLength(2))
  await act(async () =>
    completions[1]?.([ready(new File(["new"], "new.png", { type: "image/png" }), "new")]),
  )
  await act(async () => newRun)
  expect(hook.result.current.phase).toBe("review")
  await act(async () =>
    completions[0]?.([ready(new File(["old"], "old.png", { type: "image/png" }), "old")]),
  )
  await act(async () => oldRun)
  expect(hook.result.current.photos[0]?.pose.id).toBe("new")
  expect(releaseImage).toHaveBeenCalledTimes(1)
})

it("keeps the newest same-slot replacement when an older analysis finishes last", async () => {
  const completions: Array<(value: readonly ReturnType<typeof ready>[]) => void> = []
  analyzeBrowserFiles.mockImplementation(
    () =>
      new Promise((resolve) => {
        completions.push(resolve)
      }),
  )
  const hook = renderHook(() => useWorkspace())
  const initial = ready(new File(["initial"], "initial.png", { type: "image/png" }), "initial")
  await act(async () => hook.result.current.processFiles([initial.file]))
  let initialRun: Promise<void> | undefined
  act(() => {
    initialRun = hook.result.current.startAnalysis()
  })
  await waitFor(() => expect(completions).toHaveLength(1))
  await act(async () => completions[0]?.([initial]))
  await act(async () => initialRun)

  const older = ready(new File(["older"], "older.png", { type: "image/png" }), "older")
  const newer = ready(new File(["newer"], "newer.png", { type: "image/png" }), "newer")
  let olderRun: Promise<void> | undefined
  let newerRun: Promise<void> | undefined
  act(() => {
    olderRun = hook.result.current.replaceSlotPhoto("front", older.file)
  })
  await waitFor(() => expect(completions).toHaveLength(2))
  act(() => {
    newerRun = hook.result.current.replaceSlotPhoto("front", newer.file)
  })
  await waitFor(() => expect(completions).toHaveLength(3))
  await act(async () => completions[2]?.([newer]))
  await act(async () => newerRun)
  await act(async () => completions[1]?.([older]))
  await act(async () => olderRun)

  expect(hook.result.current.photos[0]?.image).toBe(newer.decoded.image)
  expect(releaseImage).toHaveBeenCalledWith(older.decoded.image)
  expect(releaseImage.mock.calls.filter(([image]) => image === older.decoded.image)).toHaveLength(1)
})

it("discards a tray retry that resolves after the workspace is reset", async () => {
  let finishRetry: ((value: readonly ReturnType<typeof ready>[]) => void) | undefined
  const files = Array.from(
    { length: 8 },
    (_, index) => new File([String(index)], `failed-${index}.png`, { type: "image/png" }),
  )
  analyzeBrowserFiles
    .mockResolvedValueOnce(files.map((file) => failed(file)))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRetry = resolve
        }),
    )
  const hook = renderHook(() => useWorkspace())
  await act(async () => hook.result.current.processFiles(files))
  await act(async () => hook.result.current.startAnalysis())
  const trayFailure = hook.result.current.trayFailures[0]
  expect(trayFailure).toBeDefined()
  if (trayFailure === undefined) return

  const late = ready(trayFailure.file, "late-tray-result")
  let retry: Promise<void> | undefined
  act(() => {
    retry = hook.result.current.retryTrayFailure(trayFailure.fileName)
  })
  await waitFor(() => expect(finishRetry).toBeDefined())
  act(() => hook.result.current.reset())
  await act(async () => finishRetry?.([late]))
  await act(async () => retry)

  expect(hook.result.current.spares).toHaveLength(0)
  expect(hook.result.current.message).toBeNull()
  expect(releaseImage.mock.calls.filter(([image]) => image === late.decoded.image)).toHaveLength(1)
})
