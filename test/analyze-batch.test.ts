// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

import type { FaceMetrics } from "../src/domain/types"
import { analyzePhotoBatch } from "../src/services/analyze-batch"

type FakeImage = {
  readonly key: string
}

function file(name: string): File {
  return new File([new Uint8Array(8)], name, { type: "image/jpeg" })
}

function metrics(yawScore: number): FaceMetrics {
  return {
    yawScore,
    pitchScore: 0,
    rollDegrees: 0,
    confidence: 0.9,
    bounds: { left: 0.2, top: 0.15, right: 0.8, bottom: 0.9 },
    anchor: { x: 0.5, y: 0.525 },
  }
}

describe("analyzePhotoBatch", () => {
  it("decodes and analyzes photos sequentially while reporting progress", async () => {
    // Given: three local files and instrumented decode/analyze boundaries.
    const events: string[] = []
    const progress = vi.fn()
    const files = [file("one.jpg"), file("two.jpg"), file("three.jpg")]

    // When: the local batch is processed.
    const result = await analyzePhotoBatch<FakeImage>(files, {
      analyze: (image) => {
        events.push(`analyze:${image.key}`)
        return metrics(Number(image.key))
      },
      classifyError: () => "analysis_failed",
      decode: async (source) => {
        events.push(`decode:${source.name}`)
        return {
          image: {
            key: source.name === "one.jpg" ? "1" : source.name === "two.jpg" ? "2" : "3",
          },
          width: 800,
          height: 1_000,
        }
      },
      onProgress: progress,
      yieldControl: async () => {
        events.push("yield")
      },
    })

    // Then: no parallel decode begins before the preceding analysis completes.
    expect(events).toEqual([
      "decode:one.jpg",
      "analyze:1",
      "yield",
      "decode:two.jpg",
      "analyze:2",
      "yield",
      "decode:three.jpg",
      "analyze:3",
    ])
    expect(result.map((item) => item.kind)).toEqual(["ready", "ready", "ready"])
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it("keeps a decoded preview when analysis fails for one photo", async () => {
    // Given: a decoder succeeds but the face analyzer rejects the image.
    const source = file("unreadable.jpg")

    // When: the per-photo failure is classified.
    const result = await analyzePhotoBatch<FakeImage>([source], {
      analyze: () => {
        throw new Error("no face")
      },
      classifyError: () => "face_not_detected",
      decode: async () => ({ image: { key: "preview" }, width: 600, height: 800 }),
    })

    // Then: the batch remains recoverable and retains the local preview object.
    expect(result[0]).toMatchObject({
      kind: "error",
      code: "face_not_detected",
      decoded: { image: { key: "preview" }, width: 600, height: 800 },
    })
  })

  it("aborts between real stages and discards an owned decoded image exactly once", async () => {
    const controller = new AbortController()
    const discardDecoded = vi.fn()
    const stages: string[] = []

    await expect(
      analyzePhotoBatch([file("one.jpg")], {
        analyze: () => {
          controller.abort()
          return metrics(0)
        },
        classifyError: () => "analysis_failed",
        decode: async () => ({ image: { key: "one" }, width: 800, height: 1_000 }),
        discardDecoded,
        onStage: (event) => stages.push(event.kind),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" })

    expect(stages).toEqual(["decoded"])
    expect(discardDecoded).toHaveBeenCalledTimes(1)
  })

  it("discards every decoded image when cancellation arrives during a later yield", async () => {
    const controller = new AbortController()
    const discarded: string[] = []
    let yields = 0
    await expect(
      analyzePhotoBatch([file("one.jpg"), file("two.jpg"), file("three.jpg")], {
        analyze: () => metrics(0),
        classifyError: () => "analysis_failed",
        decode: async (source) => ({ image: { key: source.name }, width: 8, height: 10 }),
        discardDecoded: (decoded) => discarded.push(decoded.image.key),
        signal: controller.signal,
        yieldControl: async () => {
          yields += 1
          if (yields === 2) controller.abort()
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(discarded).toEqual(["one.jpg", "two.jpg"])
  })

  it("awaits asynchronous profile recovery before emitting an analyzed item", async () => {
    const result = await analyzePhotoBatch([file("profile.jpg")], {
      analyze: async () => metrics(0.9),
      classifyError: () => "analysis_failed",
      decode: async () => ({ image: { key: "profile" }, width: 344, height: 394 }),
    })
    expect(result[0]).toMatchObject({ kind: "ready", pose: { yawScore: 0.9 } })
  })

  it("propagates stage observer failure without creating a duplicate classified item", async () => {
    const discarded: string[] = []
    await expect(
      analyzePhotoBatch([file("one.jpg")], {
        analyze: () => metrics(0),
        classifyError: () => "analysis_failed",
        decode: async () => ({ image: { key: "one" }, width: 8, height: 10 }),
        discardDecoded: (decoded) => discarded.push(decoded.image.key),
        onStage: ({ kind }) => {
          if (kind === "analyzed") throw new Error("observer")
        },
      }),
    ).rejects.toThrow("observer")
    expect(discarded).toEqual(["one"])
  })
})
