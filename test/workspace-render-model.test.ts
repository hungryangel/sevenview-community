import { describe, expect, it } from "vitest"

import { FRAMING_PRESETS } from "../src/domain/protocol-preset"
import { projectPointToTarget } from "../src/domain/render-plan"
import { CLASSIC_SEVEN_VIEW_IDS, photoId, type ViewId } from "../src/domain/types"
import {
  buildWorkspaceRenderModel,
  workspaceRenderInstruction,
} from "../src/domain/workspace-render-model"

function photo(view: ViewId = "front", sourceSize = { width: 997, height: 613 }) {
  return {
    sourceSize,
    view,
    pose: {
      id: photoId("render-model"),
      yawScore: 0,
      pitchScore: 0,
      rollDegrees: 3,
      confidence: 0.9,
      bounds: { left: 0.3, top: 0.2, right: 0.7, bottom: 0.8 },
      anchor: { x: 0.52, y: 0.48 },
    },
    adjustment: { panX: 0.01, panY: -0.02, rotationDegrees: 1, scaleMultiplier: 1.03 },
  }
}

describe("workspace render model", () => {
  it("derives resolution-independent 4:5 instructions from one immutable model", () => {
    const input = photo()
    const snapshot = structuredClone({
      sourceSize: input.sourceSize,
      pose: input.pose,
      adjustment: input.adjustment,
    })
    const model = buildWorkspaceRenderModel({
      photo: input,
      framing: FRAMING_PRESETS.clinicalStandard,
      alignment: "aligned",
    })
    // 실제 standardSeven contact-sheet layout의 타일은 520×650이다.
    const sizes = [
      { width: 400, height: 500 },
      { width: 520, height: 650 },
      { width: 800, height: 1000 },
    ] as const
    const normalized = sizes.map((size) => {
      const instruction = workspaceRenderInstruction(model, size)
      const point = projectPointToTarget(instruction, { x: 500, y: 300 })
      return {
        anchorX: instruction.targetAnchor.x / size.width,
        anchorY: instruction.targetAnchor.y / size.height,
        pointX: point.x / size.width,
        pointY: point.y / size.height,
        scale: instruction.scale / size.width,
      }
    })
    for (const candidate of normalized.slice(1)) {
      expect(candidate?.anchorX).toBeCloseTo(normalized[0]?.anchorX ?? 0, 12)
      expect(candidate?.anchorY).toBeCloseTo(normalized[0]?.anchorY ?? 0, 12)
      expect(candidate?.pointX).toBeCloseTo(normalized[0]?.pointX ?? 0, 12)
      expect(candidate?.pointY).toBeCloseTo(normalized[0]?.pointY ?? 0, 12)
      expect(candidate?.scale).toBeCloseTo(normalized[0]?.scale ?? 0, 12)
    }
    expect(model.background).toBe("#f4f4f2")
    expect({
      sourceSize: input.sourceSize,
      pose: input.pose,
      adjustment: input.adjustment,
    }).toEqual(snapshot)
  })

  it.each(CLASSIC_SEVEN_VIEW_IDS)(
    "keeps %s content normalized across actual output targets",
    (view) => {
      const model = buildWorkspaceRenderModel({
        photo: photo(view, { width: 613, height: 997 }),
        framing: FRAMING_PRESETS.clinicalStandard,
        alignment: "aligned",
      })
      const preview = workspaceRenderInstruction(model, { width: 400, height: 500 })
      const sheetTile = workspaceRenderInstruction(model, { width: 520, height: 650 })
      const individual = workspaceRenderInstruction(model, { width: 800, height: 1000 })
      expect(sheetTile.scale / 520).toBeCloseTo(preview.scale / 400, 12)
      expect(individual.scale / 800).toBeCloseTo(preview.scale / 400, 12)
      expect(sheetTile.targetAnchor.x / 520).toBeCloseTo(preview.targetAnchor.x / 400, 12)
      expect(individual.targetAnchor.y / 1000).toBeCloseTo(preview.targetAnchor.y / 500, 12)
    },
  )

  it("uses the same model for contained original viewing", () => {
    const model = buildWorkspaceRenderModel({
      photo: photo("front", { width: 4032, height: 3024 }),
      framing: FRAMING_PRESETS.clinicalStandard,
      alignment: "original",
    })
    expect(workspaceRenderInstruction(model, { width: 400, height: 500 }).scale / 400).toBeCloseTo(
      workspaceRenderInstruction(model, { width: 800, height: 1000 }).scale / 800,
      12,
    )
  })
})
