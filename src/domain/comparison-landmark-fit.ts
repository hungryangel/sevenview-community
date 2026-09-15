import type { ComparisonAngle } from "./comparison"
import type {
  ComparisonRegistrationInput,
  RegistrationInstruction,
} from "./comparison-registration"
import { projectPointToTarget } from "./render-plan"
import type {
  CropInstruction,
  FaceLandmarkGeometry,
  FaceLandmarkName,
  ImageSize,
  Point,
} from "./types"

export type LandmarkFitMetadata = {
  readonly method: "upper_face_similarity"
  readonly referenceCount: number
  readonly inlierCount: number
  readonly residualErrorPixels: number
  readonly references: readonly LandmarkFitReference[]
}

export type LandmarkFitReference = {
  readonly name: FaceLandmarkName
  readonly source: Point
  readonly target: Point
}
type Fit = { readonly instruction: CropInstruction; readonly fit: LandmarkFitMetadata }
type FitFailure = { readonly reason: "unstable_landmark_fit" | "non_finite_reference" }

const LEFT_EYE = ["screenLeftEyeOuter", "screenLeftEyeInner"] as const
const RIGHT_EYE = ["screenRightEyeOuter", "screenRightEyeInner"] as const
const MIDLINE = ["forehead", "noseBridgeUpper", "noseBridgeLower"] as const

function pixels(point: Point, size: ImageSize): Point {
  return { x: point.x * size.width, y: point.y * size.height }
}

function selectedNames(
  angle: ComparisonAngle,
  geometry: FaceLandmarkGeometry,
  size: ImageSize,
): readonly FaceLandmarkName[] {
  if (angle !== "leftProfile" && angle !== "rightProfile")
    return [...MIDLINE, ...LEFT_EYE, ...RIGHT_EYE]
  const span = (names: typeof LEFT_EYE | typeof RIGHT_EYE) => {
    const outer = pixels(geometry.named[names[0]], size)
    const inner = pixels(geometry.named[names[1]], size)
    return Math.hypot(outer.x - inner.x, outer.y - inner.y)
  }
  // The wider BEFORE eye projection selects one homologous side; the hidden eye never votes.
  return [...MIDLINE, ...(span(LEFT_EYE) >= span(RIGHT_EYE) ? LEFT_EYE : RIGHT_EYE)]
}

function leastSquares(
  pairs: readonly LandmarkFitReference[],
  targetSize: ImageSize,
): CropInstruction | null {
  const sourceAnchor = { x: 0, y: 0 }
  const targetAnchor = { x: 0, y: 0 }
  for (const pair of pairs) {
    sourceAnchor.x += pair.source.x / pairs.length
    sourceAnchor.y += pair.source.y / pairs.length
    targetAnchor.x += pair.target.x / pairs.length
    targetAnchor.y += pair.target.y / pairs.length
  }
  let dot = 0
  let cross = 0
  let variance = 0
  for (const pair of pairs) {
    const sx = pair.source.x - sourceAnchor.x
    const sy = pair.source.y - sourceAnchor.y
    const tx = pair.target.x - targetAnchor.x
    const ty = pair.target.y - targetAnchor.y
    variance += sx * sx + sy * sy
    dot += sx * tx + sy * ty
    cross += sx * ty - sy * tx
  }
  const scale = Math.hypot(dot, cross) / variance
  if (variance < 1e-8 || !Number.isFinite(scale) || scale <= 0) return null
  const degrees = (Math.atan2(cross, dot) * 180) / Math.PI
  return {
    sourceAnchor,
    targetAnchor,
    targetSize,
    scale,
    rotationDegrees: ((((degrees + 180) % 360) + 360) % 360) - 180,
  }
}

function residual(instruction: CropInstruction, pair: LandmarkFitReference): number {
  const projected = projectPointToTarget(instruction, pair.source)
  return Math.hypot(projected.x - pair.target.x, projected.y - pair.target.y)
}

function robustFit(
  pairs: readonly LandmarkFitReference[],
  targetSize: ImageSize,
): Fit | FitFailure {
  const xs = pairs.map((pair) => pair.target.x)
  const ys = pairs.map((pair) => pair.target.y)
  const spread = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const tolerance = Math.max(0.5, spread * 0.025)
  let consensus: readonly LandmarkFitReference[] = []
  let bestError = Number.POSITIVE_INFINITY
  // At most 21 deterministic seeds for seven points, followed by a single uniform LS fit.
  for (const [index, first] of pairs.entries()) {
    for (const second of pairs.slice(index + 1)) {
      const candidate = leastSquares([first, second], targetSize)
      if (candidate === null) continue
      const inliers = pairs.filter((pair) => residual(candidate, pair) <= tolerance)
      const error = inliers.reduce((sum, pair) => sum + residual(candidate, pair) ** 2, 0)
      if (
        inliers.length > consensus.length ||
        (inliers.length === consensus.length && error < bestError)
      ) {
        consensus = inliers
        bestError = error
      }
    }
  }
  if (consensus.length < pairs.length - 1) return { reason: "unstable_landmark_fit" }
  const instruction = leastSquares(consensus, targetSize)
  if (instruction === null) return { reason: "unstable_landmark_fit" }
  const residualErrorPixels = Math.sqrt(
    consensus.reduce((sum, pair) => sum + residual(instruction, pair) ** 2, 0) / consensus.length,
  )
  if (!Number.isFinite(residualErrorPixels)) return { reason: "non_finite_reference" }
  return {
    instruction,
    fit: {
      method: "upper_face_similarity",
      referenceCount: pairs.length,
      inlierCount: consensus.length,
      residualErrorPixels,
      references: Object.freeze(consensus),
    },
  }
}

export function fitComparisonLandmarks(
  input: ComparisonRegistrationInput,
  before: RegistrationInstruction,
): Fit | FitFailure | null {
  if (input.before.references !== undefined || input.after.references !== undefined) return null
  const beforeGeometry = input.before.pose?.landmarkGeometry
  const afterGeometry = input.after.pose?.landmarkGeometry
  if (beforeGeometry === undefined || afterGeometry === undefined) return null
  const names = selectedNames(input.angle, beforeGeometry, input.before.source)
  const normalized = names.flatMap((name) => [
    beforeGeometry.named[name],
    afterGeometry.named[name],
  ])
  if (
    normalized.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1,
    )
  )
    return { reason: "non_finite_reference" }
  const pairs = names.map((name) => ({
    name,
    source: pixels(afterGeometry.named[name], input.after.source),
    target: projectPointToTarget(
      before.instruction,
      pixels(beforeGeometry.named[name], input.before.source),
    ),
  }))
  return robustFit(pairs, input.target)
}
