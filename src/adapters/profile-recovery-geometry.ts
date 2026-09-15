import type { FaceMetrics, ImageSize, Point } from "../domain/types"
import { FACE_MIRROR_INDICES } from "./face-mirror-topology"

type RecoveryPass = { readonly padding: number; readonly degrees: number; readonly mirror: boolean }
export type RecoveryTransform = {
  readonly source: ImageSize
  readonly scale: number
  readonly radians: number
  readonly mirror: boolean
}
export const RECOVERY_CANVAS_SIZE = 640
// Analysis-only transforms. The source bitmap and the saved crop are never transformed here.
export const PROFILE_RECOVERY_PASSES: readonly RecoveryPass[] = [0, 0.25, 0.6].flatMap((padding) =>
  [0, -15, 15].flatMap((degrees) => [false, true].map((mirror) => ({ padding, degrees, mirror }))),
)

export function recoveryTransform(source: ImageSize, pass: RecoveryPass): RecoveryTransform {
  return {
    source,
    mirror: pass.mirror,
    radians: (pass.degrees * Math.PI) / 180,
    scale: RECOVERY_CANVAS_SIZE / (Math.max(source.width, source.height) * (1 + 2 * pass.padding)),
  }
}

export function inverseRecoveryPoints(
  points: readonly Point[],
  t: RecoveryTransform,
): readonly Point[] {
  const mapped = points.map((point) => {
    const x = (point.x * RECOVERY_CANVAS_SIZE - RECOVERY_CANVAS_SIZE / 2) / t.scale
    const y = (point.y * RECOVERY_CANVAS_SIZE - RECOVERY_CANVAS_SIZE / 2) / t.scale
    return {
      x:
        0.5 +
        ((t.mirror ? -1 : 1) * (Math.cos(t.radians) * x + Math.sin(t.radians) * y)) /
          t.source.width,
      y: 0.5 + (-Math.sin(t.radians) * x + Math.cos(t.radians) * y) / t.source.height,
    }
  })
  if (!t.mirror) return mapped
  return FACE_MIRROR_INDICES.map((index) => {
    const point = mapped[index]
    if (point === undefined) throw new Error("Incomplete recovery mesh")
    return point
  })
}

// Conservative recovery acceptance gates, not clinical accuracy or treatment measurements.
// Low-threshold spurious detections in the regression cases put the chin above the forehead
// or rotate the hidden-eye line by 37–110 degrees. Those must stay in manual review.
export function isPlausibleProfileRecovery(metrics: FaceMetrics): boolean {
  const geometry = metrics.landmarkGeometry
  if (geometry === undefined || geometry.points.length !== 478) return false
  if (
    !Number.isFinite(metrics.yawScore) ||
    Math.abs(metrics.yawScore) < 0.55 ||
    !Number.isFinite(metrics.rollDegrees) ||
    Math.abs(metrics.rollDegrees) > 25
  )
    return false
  if (
    geometry.points.some(
      (p) =>
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1,
    )
  )
    return false
  const { forehead, chin, noseBridgeLower, noseTip } = geometry.named
  const lip = geometry.points[13]
  if (lip === undefined) return false
  const height = chin.y - forehead.y
  return (
    height >= 0.2 &&
    height <= 0.9 &&
    Math.abs(chin.x - forehead.x) < height * 0.65 &&
    noseBridgeLower.y > forehead.y + height * 0.1 &&
    noseTip.y > noseBridgeLower.y + height * 0.03 &&
    lip.y > noseTip.y + height * 0.04 &&
    lip.y < chin.y - height * 0.08
  )
}

export function matchingRecovery(
  candidates: readonly FaceMetrics[],
  next: FaceMetrics,
): FaceMetrics | null {
  const nextGeometry = next.landmarkGeometry
  if (nextGeometry === undefined) return null
  // Upper-face registration points plus independent nose/lip/chin checks. Changed anatomy is
  // not fitted across BEFORE/AFTER: these predictions are repeated views of the SAME source.
  const indices = [10, 168, 6, 1, 13, 152, 33, 133, 263, 362] as const
  const tolerance = (nextGeometry.named.chin.y - nextGeometry.named.forehead.y) * 0.035
  for (const candidate of candidates) {
    const previous = candidate.landmarkGeometry
    if (previous === undefined || Math.sign(candidate.yawScore) !== Math.sign(next.yawScore))
      continue
    if (
      indices.every((index) => {
        const a = previous.points[index]
        const b = nextGeometry.points[index]
        return a !== undefined && b !== undefined && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance
      })
    )
      return candidate
  }
  return null
}
