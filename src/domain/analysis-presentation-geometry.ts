import type { CropInstruction } from "./types"

export type CssMatrix = readonly [number, number, number, number, number, number]
export type ResponsiveCropTransform = {
  readonly linear: string
  readonly translateXPercent: number
  readonly translateYPercent: number
}

export function relativeCropMatrix(source: CropInstruction, target: CropInstruction): CssMatrix {
  const radians = (target.rotationDegrees - source.rotationDegrees) * (Math.PI / 180)
  const scale = target.scale / source.scale
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const a = cosine * scale
  const b = sine * scale
  const c = -sine * scale
  const d = cosine * scale
  const sourceAnchorAtSource = {
    x: source.targetAnchor.x,
    y: source.targetAnchor.y,
  }
  const sourceAnchorAtTarget = {
    x:
      target.targetAnchor.x +
      target.scale *
        (cosine * (source.sourceAnchor.x - target.sourceAnchor.x) -
          sine * (source.sourceAnchor.y - target.sourceAnchor.y)),
    y:
      target.targetAnchor.y +
      target.scale *
        (sine * (source.sourceAnchor.x - target.sourceAnchor.x) +
          cosine * (source.sourceAnchor.y - target.sourceAnchor.y)),
  }
  return [
    a,
    b,
    c,
    d,
    sourceAnchorAtTarget.x - (a * sourceAnchorAtSource.x + c * sourceAnchorAtSource.y),
    sourceAnchorAtTarget.y - (b * sourceAnchorAtSource.x + d * sourceAnchorAtSource.y),
  ]
}

export function cssMatrixValue(matrix: CssMatrix): string {
  return `matrix(${matrix.map((value) => Number(value.toFixed(6))).join(", ")})`
}

export function responsiveCropTransform(
  source: CropInstruction,
  target: CropInstruction,
): ResponsiveCropTransform {
  const [a, b, c, d, x, y] = relativeCropMatrix(source, target)
  return {
    linear: cssMatrixValue([a, b, c, d, 0, 0]),
    translateXPercent: (x / target.targetSize.width) * 100,
    translateYPercent: (y / target.targetSize.height) * 100,
  }
}
