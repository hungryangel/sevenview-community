import type { ImageSize, Point } from "../domain/types"

export function sourcePointFromClient(
  client: Point,
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
  source: ImageSize,
): Point | null {
  if (bounds.width <= 0 || bounds.height <= 0 || source.width <= 0 || source.height <= 0)
    return null
  const scale = Math.min(bounds.width / source.width, bounds.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  const left = bounds.left + (bounds.width - width) / 2
  const top = bounds.top + (bounds.height - height) / 2
  const x = (client.x - left) / width
  const y = (client.y - top) / height
  return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y }
}
