// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

import type { FaceMetrics } from "../src/domain/types"
import { analyzeLocalFiles } from "../src/services/analyze-local-files"

const metrics: FaceMetrics = {
  yawScore: 0,
  pitchScore: 0,
  rollDegrees: 0,
  confidence: 0.9,
  bounds: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 },
  anchor: { x: 0.5, y: 0.5 },
}

describe("analyzeLocalFiles", () => {
  it("preserves the analyzer receiver while invoking its analyze method", async () => {
    // Given: an analyzer whose method reads instance state like the MediaPipe adapter does.
    const close = vi.fn()
    const analyzer = {
      expected: metrics,
      analyze() {
        return this.expected
      },
      close,
    }
    const file = new File(["before"], "before.jpg", { type: "image/jpeg" })

    // When: the local service invokes the analyzer.
    const results = await analyzeLocalFiles([file], {
      createAnalyzer: async () => analyzer,
      decode: async () => ({ image: "image", width: 800, height: 1000 }),
      classifyError: () => "analysis_failed",
    })

    // Then: method binding is intact and the file reaches ready.
    expect(results[0]).toMatchObject({ kind: "ready", pose: { confidence: metrics.confidence } })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("uses one same-origin analyzer for two files and closes it exactly once", async () => {
    // Given: two files and an instrumented local analyzer factory.
    const close = vi.fn()
    const createAnalyzer = vi.fn(async () => ({ analyze: () => metrics, close }))
    const files = [
      new File(["before"], "before.jpg", { type: "image/jpeg" }),
      new File(["after"], "after.jpg", { type: "image/jpeg" }),
    ]

    // When: both files are analyzed as one run.
    const results = await analyzeLocalFiles(files, {
      createAnalyzer,
      decode: async (file) => ({ image: file.name, width: 800, height: 1000 }),
      classifyError: () => "analysis_failed",
      yieldControl: async () => undefined,
    })

    // Then: creation and cleanup each happen once and both results are preserved in order.
    expect(results.map((result) => result.kind)).toEqual(["ready", "ready"])
    expect(createAnalyzer).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("closes the analyzer when batch processing fails unexpectedly", async () => {
    // Given: an analyzer and a progress callback that interrupts the batch.
    const close = vi.fn()
    const source = new File(["before"], "before.jpg", { type: "image/jpeg" })

    // When/Then: the error propagates but the analyzer is still closed.
    await expect(
      analyzeLocalFiles([source], {
        createAnalyzer: async () => ({ analyze: () => metrics, close }),
        decode: async () => ({ image: "image", width: 800, height: 1000 }),
        classifyError: () => "analysis_failed",
        onProgress: () => {
          throw new TypeError("interrupted")
        },
      }),
    ).rejects.toThrow("interrupted")
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("closes an analyzer that resolves after cancellation", async () => {
    const controller = new AbortController()
    const close = vi.fn()
    let resolveCreation:
      | ((analyzer: { analyze: () => FaceMetrics; close: () => void }) => void)
      | undefined
    const creation = new Promise<{ analyze: () => FaceMetrics; close: () => void }>((resolve) => {
      resolveCreation = resolve
    })

    const result = analyzeLocalFiles([new File(["x"], "x.jpg")], {
      createAnalyzer: () => creation,
      decode: async () => ({ image: "image", width: 800, height: 1000 }),
      classifyError: () => "analysis_failed",
      signal: controller.signal,
    })
    controller.abort()
    resolveCreation?.({ analyze: () => metrics, close })
    await expect(result).rejects.toMatchObject({ name: "AbortError" })
    expect(close).toHaveBeenCalledTimes(1)
  })
})
