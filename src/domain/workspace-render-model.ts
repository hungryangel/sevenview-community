import { createAutoCrop, createContainCrop, mergeCropAdjustment } from "./crop"
import { EXPORT_RENDER_STYLE } from "./export-render-style"
import type { FramingPreset, FramingPresetId } from "./protocol-preset"
import type { CropAdjustment, CropInstruction, ImageSize, PhotoPose, ViewId } from "./types"

const MODEL_TARGET = { width: 4, height: 5 } as const

export type WorkspaceRenderAlignment = "aligned" | "original"

type WorkspaceRenderPhoto = {
  readonly adjustment: CropAdjustment
  readonly pose: PhotoPose
  readonly sourceSize: ImageSize
  readonly view: ViewId
}

export type WorkspaceRenderModel = {
  readonly adjustment: CropAdjustment
  readonly alignment: WorkspaceRenderAlignment
  readonly background: typeof EXPORT_RENDER_STYLE.background
  readonly framingPresetId: FramingPresetId
  readonly normalizedInstruction: CropInstruction
  readonly sourceSize: ImageSize
  readonly view: ViewId
}

export type WorkspaceRenderModelInput = {
  readonly alignment: WorkspaceRenderAlignment
  readonly framing: FramingPreset
  readonly photo: WorkspaceRenderPhoto
}

export function buildWorkspaceRenderModel(input: WorkspaceRenderModelInput): WorkspaceRenderModel {
  const automatic =
    input.alignment === "original"
      ? createContainCrop(input.photo.sourceSize, MODEL_TARGET)
      : createAutoCrop({
          framing: input.framing,
          pose: input.photo.pose,
          source: input.photo.sourceSize,
          target: MODEL_TARGET,
          view: input.photo.view,
        })
  const normalizedInstruction =
    input.alignment === "original"
      ? automatic
      : mergeCropAdjustment(automatic, input.photo.adjustment)
  return {
    adjustment: input.photo.adjustment,
    alignment: input.alignment,
    background: EXPORT_RENDER_STYLE.background,
    framingPresetId: input.framing.id,
    normalizedInstruction,
    sourceSize: input.photo.sourceSize,
    view: input.photo.view,
  }
}

export function workspaceRenderInstruction(
  model: WorkspaceRenderModel,
  target: ImageSize,
): CropInstruction {
  const factor = target.width / MODEL_TARGET.width
  return {
    sourceAnchor: model.normalizedInstruction.sourceAnchor,
    targetAnchor: {
      x: model.normalizedInstruction.targetAnchor.x * factor,
      y: model.normalizedInstruction.targetAnchor.y * factor,
    },
    targetSize: target,
    scale: model.normalizedInstruction.scale * factor,
    rotationDegrees: model.normalizedInstruction.rotationDegrees,
  }
}
