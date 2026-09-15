import { useEffect, useRef } from "react"

import { drawPrivacyCroppedImage } from "../adapters/eye-mosaic"
import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import type { EyePrivacyRaster } from "../domain/comparison-eye-privacy"
import type { RenderableComparisonSlot } from "../domain/comparison-session"
import type { ComparisonPhotoInformationMode } from "./comparison-photo-information"
import { ComparisonPhotoOverlay } from "./comparison-photo-overlay"
import type { ComparisonRenderSide } from "./comparison-render-model"

const PREVIEW_SIZE = { width: 400, height: 500 } as const
const SIDE_LABELS = { before: "시술 전", after: "시술 후" } as const

export type ReadyComparisonSlot = RenderableComparisonSlot<CanvasImageSource>

type ComparisonPreviewProps = {
  readonly "aria-hidden"?: boolean
  readonly className?: string
  readonly informationMode?: ComparisonPhotoInformationMode
  readonly angle: ComparisonAngle
  readonly side: ComparisonSide
  readonly render: ComparisonRenderSide
  readonly privacy?: EyePrivacyRaster
}

export function ComparisonPreview({
  "aria-hidden": ariaHidden,
  className = "",
  informationMode = "off",
  angle,
  side,
  render,
  privacy = { enabled: false },
}: ComparisonPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (canvas === null || context === null || context === undefined) {
      return
    }
    context.fillStyle = "#f4f4f2"
    context.fillRect(0, 0, PREVIEW_SIZE.width, PREVIEW_SIZE.height)
    if (privacy.enabled && privacy.mask === null) return
    drawPrivacyCroppedImage(context, render.slot.decoded.image, render.instruction, privacy)
  }, [privacy, render])

  return (
    <div aria-hidden={ariaHidden} className={`comparison-preview-frame ${className}`.trim()}>
      <canvas
        aria-label={`${SIDE_LABELS[side]} 정렬 미리보기`}
        className="comparison-preview"
        height={PREVIEW_SIZE.height}
        ref={canvasRef}
        role="img"
        width={PREVIEW_SIZE.width}
      >
        {SIDE_LABELS[side]} 정렬 미리보기
      </canvas>
      <ComparisonPhotoOverlay angle={angle} mode={informationMode} render={render} side={side} />
    </div>
  )
}
