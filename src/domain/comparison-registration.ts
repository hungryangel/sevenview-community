import type { ComparisonAngle, ComparisonSide } from "./comparison"
import { fitComparisonLandmarks, type LandmarkFitMetadata } from "./comparison-landmark-fit"
import { instructionLeavesNeutralMargin, projectionError } from "./comparison-registration-geometry"
import { projectPointToTarget } from "./render-plan"
import type { CropInstruction, ImageSize, PhotoPose, Point } from "./types"

export { instructionLeavesNeutralMargin } from "./comparison-registration-geometry"

const MIN_REFERENCE_DISTANCE = 1e-4

export type RegistrationReferences = {
  readonly first: Point
  readonly second: Point
}

export type RegistrationSource = {
  readonly pose: PhotoPose | null
  readonly source: ImageSize
  readonly references?: RegistrationReferences
}

export type RegistrationInstruction = {
  readonly instruction: CropInstruction
  readonly sourceReferences: RegistrationReferences
  readonly targetReferences: RegistrationReferences
  readonly provenance: "detected" | "manual"
  readonly neutralMargin: boolean
  readonly preResidualErrorPixels: number
  readonly fit?: LandmarkFitMetadata
}

export type ComparisonRegistrationResult =
  | {
      readonly kind: "ready"
      readonly before: RegistrationInstruction
      readonly after: RegistrationInstruction
    }
  | {
      readonly kind: "reviewRequired"
      readonly reason:
        | "missing_landmarks"
        | "non_finite_reference"
        | "coincident_reference"
        | "rotation_review_required"
        | "unstable_landmark_fit"
      readonly side: ComparisonSide
    }

type RegistrationReview = Extract<ComparisonRegistrationResult, { readonly kind: "reviewRequired" }>
type RegistrationFailure = { readonly reason: RegistrationReview["reason"] }

type RegistrationFrame = {
  readonly angle: ComparisonAngle
  readonly preserveBeforeOrientation: boolean
  readonly target: ImageSize
  readonly reference?: RegistrationInstruction
}

export type ComparisonRegistrationInput = {
  readonly angle: ComparisonAngle
  readonly manualRecovery?: boolean
  readonly before: RegistrationSource
  readonly after: RegistrationSource
  readonly target: ImageSize
}

function sourceReferences(
  angle: ComparisonAngle,
  input: RegistrationSource,
): RegistrationReferences | null {
  if (input.references !== undefined) return input.references
  const geometry = input.pose?.landmarkGeometry
  if (angle !== "front" && geometry !== undefined)
    return { first: geometry.named.forehead, second: geometry.named.noseBridgeLower }
  const anchors = input.pose?.registrationAnchors
  if (anchors === undefined) return null
  if (angle === "front") {
    return { first: anchors.screenLeftEye, second: anchors.screenRightEye }
  }
  return {
    first: {
      x: (anchors.screenLeftEye.x + anchors.screenRightEye.x) / 2,
      y: (anchors.screenLeftEye.y + anchors.screenRightEye.y) / 2,
    },
    second: anchors.noseTip,
  }
}

function isFiniteUnit(point: Point): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  )
}

function isPositiveSize(size: ImageSize): boolean {
  return (
    Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0
  )
}

function solveSide(
  input: RegistrationSource,
  frame: RegistrationFrame,
): RegistrationInstruction | RegistrationFailure {
  const { angle, target, reference } = frame
  const canonicalFront = angle === "front" && !frame.preserveBeforeOrientation
  if (!isPositiveSize(input.source) || !isPositiveSize(target))
    return { reason: "non_finite_reference" }
  const normalized = sourceReferences(angle, input)
  if (normalized === null) return { reason: "missing_landmarks" }
  if (!isFiniteUnit(normalized.first) || !isFiniteUnit(normalized.second))
    return { reason: "non_finite_reference" }
  const normalizedDistance = Math.hypot(
    normalized.second.x - normalized.first.x,
    normalized.second.y - normalized.first.y,
  )
  if (normalizedDistance < MIN_REFERENCE_DISTANCE) return { reason: "coincident_reference" }
  const sourceRefs = {
    first: {
      x: normalized.first.x * input.source.width,
      y: normalized.first.y * input.source.height,
    },
    second: {
      x: normalized.second.x * input.source.width,
      y: normalized.second.y * input.source.height,
    },
  }
  const baseline: CropInstruction = {
    sourceAnchor: { x: input.source.width / 2, y: input.source.height / 2 },
    targetAnchor: { x: target.width / 2, y: target.height / 2 },
    targetSize: target,
    scale: Math.min(target.width / input.source.width, target.height / input.source.height),
    rotationDegrees: 0,
  }
  const targetRefs =
    reference?.targetReferences ??
    (canonicalFront
      ? {
          first: { x: target.width * 0.35, y: target.height * 0.4 },
          second: { x: target.width * 0.65, y: target.height * 0.4 },
        }
      : {
          first: projectPointToTarget(baseline, sourceRefs.first),
          second: projectPointToTarget(baseline, sourceRefs.second),
        })
  const sourceVector = {
    x: sourceRefs.second.x - sourceRefs.first.x,
    y: sourceRefs.second.y - sourceRefs.first.y,
  }
  const targetVector = {
    x: targetRefs.second.x - targetRefs.first.x,
    y: targetRefs.second.y - targetRefs.first.y,
  }
  const scale =
    Math.hypot(targetVector.x, targetVector.y) / Math.hypot(sourceVector.x, sourceVector.y)
  // Relative rotation uses BEFORE's pixel vector directly, so identical sources stay exactly at 0°.
  const rotationRefs = canonicalFront ? targetRefs : (reference?.sourceReferences ?? sourceRefs)
  const rotationDelta =
    ((Math.atan2(
      rotationRefs.second.y - rotationRefs.first.y,
      rotationRefs.second.x - rotationRefs.first.x,
    ) -
      Math.atan2(sourceVector.y, sourceVector.x)) *
      180) /
    Math.PI
  const rotationDegrees = ((((rotationDelta + 180) % 360) + 360) % 360) - 180
  const instruction: CropInstruction =
    !canonicalFront && reference === undefined
      ? baseline
      : {
          sourceAnchor: {
            x: (sourceRefs.first.x + sourceRefs.second.x) / 2,
            y: (sourceRefs.first.y + sourceRefs.second.y) / 2,
          },
          targetAnchor: {
            x: (targetRefs.first.x + targetRefs.second.x) / 2,
            y: (targetRefs.first.y + targetRefs.second.y) / 2,
          },
          targetSize: target,
          scale,
          rotationDegrees,
        }
  const computedPoints = [
    sourceRefs.first,
    sourceRefs.second,
    targetRefs.first,
    targetRefs.second,
    instruction.sourceAnchor,
    instruction.targetAnchor,
  ]
  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Number.isFinite(rotationDegrees) ||
    computedPoints.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  )
    return { reason: "non_finite_reference" }
  const preResidualErrorPixels = Math.max(
    projectionError(instruction, sourceRefs.first, targetRefs.first),
    projectionError(instruction, sourceRefs.second, targetRefs.second),
  )
  if (!Number.isFinite(preResidualErrorPixels)) return { reason: "non_finite_reference" }
  return {
    instruction,
    sourceReferences: sourceRefs,
    targetReferences: targetRefs,
    provenance: input.references === undefined ? "detected" : "manual",
    neutralMargin: instructionLeavesNeutralMargin(instruction, input.source),
    preResidualErrorPixels,
  }
}

export function solveComparisonRegistration(
  input: ComparisonRegistrationInput,
): ComparisonRegistrationResult {
  const manualRecovery =
    input.manualRecovery === true || input.before.pose === null || input.after.pose === null
  if (manualRecovery) {
    for (const side of ["before", "after"] as const) {
      if (input[side].references === undefined)
        return { kind: "reviewRequired", reason: "missing_landmarks", side }
    }
  }
  const frame = {
    angle: input.angle,
    target: input.target,
    preserveBeforeOrientation: manualRecovery,
  }
  const before = solveSide(input.before, frame)
  if ("reason" in before) return { kind: "reviewRequired", reason: before.reason, side: "before" }
  const pairAfter = solveSide(input.after, { ...frame, reference: before })
  if ("reason" in pairAfter)
    return { kind: "reviewRequired", reason: pairAfter.reason, side: "after" }
  const fit = fitComparisonLandmarks(input, before)
  if (fit !== null && "reason" in fit)
    return { kind: "reviewRequired", reason: fit.reason, side: "after" }
  const after =
    fit === null
      ? pairAfter
      : {
          ...pairAfter,
          ...fit,
          neutralMargin: instructionLeavesNeutralMargin(fit.instruction, input.after.source),
          preResidualErrorPixels: fit.fit.residualErrorPixels,
        }
  const manualPair = input.before.references !== undefined && input.after.references !== undefined
  if (input.angle !== "front" && !manualPair && Math.abs(after.instruction.rotationDegrees) > 15) {
    return { kind: "reviewRequired", reason: "rotation_review_required", side: "after" }
  }
  return { kind: "ready", before, after }
}
