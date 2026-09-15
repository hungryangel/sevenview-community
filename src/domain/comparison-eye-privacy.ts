import type { FaceLandmarkGeometry, ImageSize, Rect } from "./types"

export type EyePrivacyProvenance = "detected" | "manual"

export type EyePrivacyMask = {
  readonly provenance: EyePrivacyProvenance
  readonly regions: readonly Rect[]
}

export type EyePrivacyRaster =
  | { readonly enabled: false }
  | {
      readonly enabled: true
      readonly mask: EyePrivacyMask | null
      readonly sourceSize: ImageSize
    }

const MINIMUM_SPAN = 0.01

function validCoordinate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

export function isNormalizedEyePrivacyRect(rect: Rect): boolean {
  return (
    validCoordinate(rect.left) &&
    validCoordinate(rect.top) &&
    validCoordinate(rect.right) &&
    validCoordinate(rect.bottom) &&
    rect.right - rect.left >= MINIMUM_SPAN &&
    rect.bottom - rect.top >= MINIMUM_SPAN
  )
}

export function isUsableEyePrivacyMask(
  mask: EyePrivacyMask | null | undefined,
): mask is EyePrivacyMask {
  return (
    mask !== null &&
    mask !== undefined &&
    mask.regions.length > 0 &&
    mask.regions.every(isNormalizedEyePrivacyRect)
  )
}

export function createManualEyePrivacyMask(rect: Rect): EyePrivacyMask | null {
  return isNormalizedEyePrivacyRect(rect) ? { provenance: "manual", regions: [{ ...rect }] } : null
}

type EyeNames = Pick<
  FaceLandmarkGeometry["named"],
  | "screenLeftEyeOuter"
  | "screenLeftEyeInner"
  | "screenLeftEyeUpper"
  | "screenLeftEyeLower"
  | "screenRightEyeOuter"
  | "screenRightEyeInner"
  | "screenRightEyeUpper"
  | "screenRightEyeLower"
>

function conservativeRegion(
  points: readonly { readonly x: number; readonly y: number }[],
): Rect | null {
  if (points.some(({ x, y }) => !validCoordinate(x) || !validCoordinate(y))) return null
  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const horizontalMargin = Math.max(0.018, (right - left) * 0.45)
  const verticalMargin = Math.max(0.018, (bottom - top) * 0.8)
  const region = {
    left: Math.max(0, left - horizontalMargin),
    right: Math.min(1, right + horizontalMargin),
    top: Math.max(0, top - verticalMargin),
    bottom: Math.min(1, bottom + verticalMargin),
  }
  return isNormalizedEyePrivacyRect(region) ? region : null
}

export function createDetectedEyePrivacyMask(named: EyeNames): EyePrivacyMask | null {
  const left = conservativeRegion([
    named.screenLeftEyeOuter,
    named.screenLeftEyeInner,
    named.screenLeftEyeUpper,
    named.screenLeftEyeLower,
  ])
  const right = conservativeRegion([
    named.screenRightEyeOuter,
    named.screenRightEyeInner,
    named.screenRightEyeUpper,
    named.screenRightEyeLower,
  ])
  return left === null || right === null ? null : { provenance: "detected", regions: [left, right] }
}

export function eyePrivacyIdentity(
  enabled: boolean,
  revision: number,
  generations: Readonly<Record<"before" | "after", number>>,
): string {
  return `${enabled ? "on" : "off"}:${revision}:${generations.before}:${generations.after}`
}
