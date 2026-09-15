import { type RefObject, useEffect } from "react"
import type { Point } from "../domain/types"
import type { ReadyComparisonSlot } from "./comparison-preview"

export function useComparisonSourceCanvas(
  canvas: RefObject<HTMLCanvasElement | null>,
  loupeCanvas: RefObject<HTMLCanvasElement | null>,
  slot: ReadyComparisonSlot,
  loupe: Point | null,
) {
  useEffect(() => {
    const target = canvas.current
    const context = target?.getContext("2d")
    if (target === null || context == null) return
    context.clearRect(0, 0, target.width, target.height)
    context.drawImage(slot.decoded.image, 0, 0, target.width, target.height)
  }, [canvas, slot])
  useEffect(() => {
    const target = loupeCanvas.current
    const source = canvas.current
    if (loupe === null || target === null || source === null) return
    const draw = () => {
      const context = target.getContext("2d")
      const displayedWidth = source.getBoundingClientRect().width
      if (context === null || displayedWidth <= 0) return
      const span = target.getBoundingClientRect().width / 3 / (displayedWidth / slot.decoded.width)
      context.clearRect(0, 0, target.width, target.height)
      context.drawImage(
        slot.decoded.image,
        loupe.x * slot.decoded.width - span / 2,
        loupe.y * slot.decoded.height - span / 2,
        span,
        span,
        0,
        0,
        target.width,
        target.height,
      )
    }
    draw()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(draw)
    observer.observe(source)
    return () => observer.disconnect()
  }, [canvas, loupeCanvas, loupe, slot])
}
