import { useLayoutEffect, useMemo, useRef } from "react"
import { drawCroppedImage } from "../adapters/canvas"
import { responsiveCropTransform } from "../domain/analysis-presentation-geometry"
import type { FramingPreset } from "../domain/protocol-preset"
import { projectPointToTarget } from "../domain/render-plan"
import type { CropInstruction, Point } from "../domain/types"
import type { WorkspacePhoto } from "../domain/workspace"
import {
  buildWorkspaceRenderModel,
  workspaceRenderInstruction,
} from "../domain/workspace-render-model"
import { LandmarkOverlay } from "./landmark-overlay"

const PRESENTATION_TARGET = { width: 400, height: 500 } as const

type WorkspacePresentationItem = {
  readonly framing: FramingPreset
  readonly photo: WorkspacePhoto<CanvasImageSource>
}

export type ExplicitPresentationItem = {
  readonly alignedInstruction: CropInstruction
  readonly id: string
  readonly image: CanvasImageSource
  readonly normalizedPoints: readonly Point[]
  readonly originalInstruction: CropInstruction
}

export type CompletionPresentationItem = WorkspacePresentationItem | ExplicitPresentationItem

export function completionPresentationItemKey(item: CompletionPresentationItem): string {
  return "photo" in item ? item.photo.pose.id : item.id
}

type CompletionPresentationFrameProps = {
  readonly item: CompletionPresentationItem
}

export function CompletionPresentationFrame({ item }: CompletionPresentationFrameProps) {
  const sourceCanvas = useRef<HTMLCanvasElement>(null)
  const finalCanvas = useRef<HTMLCanvasElement>(null)
  const sourceLayer = useRef<HTMLSpanElement>(null)
  const render = useMemo(() => {
    if (!("photo" in item)) {
      return {
        aligned: item.alignedInstruction,
        image: item.image,
        points: item.normalizedPoints,
        transform: responsiveCropTransform(item.originalInstruction, item.alignedInstruction),
        original: item.originalInstruction,
      }
    }
    const original = workspaceRenderInstruction(
      buildWorkspaceRenderModel({
        alignment: "original",
        framing: item.framing,
        photo: item.photo,
      }),
      PRESENTATION_TARGET,
    )
    const aligned = workspaceRenderInstruction(
      buildWorkspaceRenderModel({ alignment: "aligned", framing: item.framing, photo: item.photo }),
      PRESENTATION_TARGET,
    )
    const anchors = item.photo.pose.registrationAnchors
    const points =
      anchors === undefined
        ? undefined
        : [anchors.screenLeftEye, anchors.screenRightEye, anchors.noseTip].map((point) => {
            const projected = projectPointToTarget(original, {
              x: point.x * item.photo.sourceSize.width,
              y: point.y * item.photo.sourceSize.height,
            })
            return {
              x: projected.x / PRESENTATION_TARGET.width,
              y: projected.y / PRESENTATION_TARGET.height,
            }
          })
    return {
      aligned,
      image: item.photo.image,
      points,
      transform: responsiveCropTransform(original, aligned),
      original,
    }
  }, [item])

  useLayoutEffect(() => {
    const sourceContext = sourceCanvas.current?.getContext("2d")
    const finalContext = finalCanvas.current?.getContext("2d")
    if (sourceContext === null || sourceContext === undefined) return
    if (finalContext === null || finalContext === undefined) return
    drawCroppedImage(sourceContext, render.image, render.original)
    drawCroppedImage(finalContext, render.image, render.aligned)
    sourceLayer.current?.style.setProperty("--analysis-crop-linear", render.transform.linear)
    sourceLayer.current?.style.setProperty(
      "--analysis-crop-x",
      `${render.transform.translateXPercent}%`,
    )
    sourceLayer.current?.style.setProperty(
      "--analysis-crop-y",
      `${render.transform.translateYPercent}%`,
    )
  }, [render])

  return (
    <span className="completion-presentation-frame">
      <canvas
        aria-label="완성된 실제 크롭"
        className="completion-presentation-frame__final"
        height={PRESENTATION_TARGET.height}
        ref={finalCanvas}
        width={PRESENTATION_TARGET.width}
      />
      <span className="completion-presentation-frame__source" ref={sourceLayer}>
        <canvas
          aria-label="크롭 전 실제 원본"
          height={PRESENTATION_TARGET.height}
          ref={sourceCanvas}
          width={PRESENTATION_TARGET.width}
        />
        <LandmarkOverlay
          {...(render.points === undefined
            ? { anchors: null }
            : { normalizedPoints: render.points })}
        />
      </span>
    </span>
  )
}
