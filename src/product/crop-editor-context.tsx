import { useEffect, useMemo, useRef } from "react"

import { drawCroppedImage } from "../adapters/canvas"
import { buildCropContextGeometry } from "../domain/crop-context-geometry"
import type { CropInstruction } from "../domain/types"

type CropEditorContextProps = {
  readonly crop: CropInstruction
  readonly image: CanvasImageSource
}

export function CropEditorContext({ crop, image }: CropEditorContextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const geometry = useMemo(() => buildCropContextGeometry(crop), [crop])
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d")
    if (context === null || context === undefined) return
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap && image.width === 0)
      return
    drawCroppedImage(context, image, geometry.contextInstruction)
  }, [geometry.contextInstruction, image])
  return (
    <div aria-hidden="true" className="crop-editor-context">
      <canvas height={548} ref={canvasRef} width={448} />
      <span className="crop-editor-context__mask crop-editor-context__mask--top" />
      <span className="crop-editor-context__mask crop-editor-context__mask--right" />
      <span className="crop-editor-context__mask crop-editor-context__mask--bottom" />
      <span className="crop-editor-context__mask crop-editor-context__mask--left" />
      <svg aria-hidden="true" className="crop-editor-context__boundary" viewBox="0 0 448 548">
        <polygon points={geometry.boundary.map(({ x, y }) => `${x},${y}`).join(" ")} />
      </svg>
    </div>
  )
}
