import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import {
  instructionLeavesNeutralMargin,
  type RegistrationInstruction,
  type RegistrationReferences,
  solveComparisonRegistration,
} from "../domain/comparison-registration"
import { mergeCropAdjustment } from "../domain/crop"
import { projectPointToTarget } from "../domain/render-plan"
import type {
  CropAdjustment,
  CropInstruction,
  FaceLandmarkName,
  ImageSize,
  Point,
} from "../domain/types"
import type { ReadyComparisonSlot } from "./comparison-preview"

export const COMPARISON_PREVIEW_SIZE = { height: 500, width: 400 } as const
export const EMPTY_COMPARISON_ADJUSTMENT: CropAdjustment = {
  panX: 0,
  panY: 0,
  rotationDegrees: 0,
  scaleMultiplier: 1,
}

export type ManualComparisonReferences = Readonly<
  Partial<Record<ComparisonSide, RegistrationReferences>>
>

export type ComparisonRenderSide = {
  readonly fit?: RegistrationInstruction["fit"]
  readonly projectedRegistrationPoints?: readonly (Point & { readonly name: FaceLandmarkName })[]
  readonly instruction: CropInstruction
  readonly neutralMargin: boolean
  readonly postResidualDisplacementPixels: number
  readonly preResidualErrorPixels: number
  readonly provenance: "detected" | "manual"
  readonly references: RegistrationReferences
  readonly slot: ReadyComparisonSlot
}

export type ComparisonRenderModel =
  | {
      readonly kind: "reviewRequired"
      readonly reason:
        | "missing_landmarks"
        | "non_finite_reference"
        | "coincident_reference"
        | "rotation_review_required"
        | "unstable_landmark_fit"
      readonly revision: number
      readonly side: ComparisonSide
    }
  | {
      readonly after: ComparisonRenderSide
      readonly angle: ComparisonAngle
      readonly before: ComparisonRenderSide
      readonly kind: "ready"
      readonly residual: CropAdjustment
      readonly revision: number
    }

type BuildComparisonRenderModelInput = {
  readonly angle: ComparisonAngle
  readonly manualRecovery?: boolean
  readonly manualReferences: ManualComparisonReferences
  readonly pair: { readonly before: ReadyComparisonSlot; readonly after: ReadyComparisonSlot }
  readonly residual: CropAdjustment
  readonly revision: number
}

function displacement(instruction: CropInstruction, point: Point, target: Point): number {
  const projected = projectPointToTarget(instruction, point)
  return Math.hypot(projected.x - target.x, projected.y - target.y)
}

export function buildComparisonRenderModel(
  input: BuildComparisonRenderModelInput,
): ComparisonRenderModel {
  if (
    !Number.isFinite(input.residual.panX) ||
    !Number.isFinite(input.residual.panY) ||
    !Number.isFinite(input.residual.rotationDegrees) ||
    !Number.isFinite(input.residual.scaleMultiplier) ||
    input.residual.scaleMultiplier <= 0
  ) {
    return {
      kind: "reviewRequired",
      reason: "non_finite_reference",
      revision: input.revision,
      side: "after",
    }
  }
  const registration = solveComparisonRegistration({
    angle: input.angle,
    manualRecovery: input.manualRecovery ?? false,
    before: {
      pose: input.pair.before.kind === "ready" ? input.pair.before.pose : null,
      source: input.pair.before.decoded,
      ...(input.manualReferences.before === undefined
        ? {}
        : { references: input.manualReferences.before }),
    },
    after: {
      pose: input.pair.after.kind === "ready" ? input.pair.after.pose : null,
      source: input.pair.after.decoded,
      ...(input.manualReferences.after === undefined
        ? {}
        : { references: input.manualReferences.after }),
    },
    target: COMPARISON_PREVIEW_SIZE,
  })
  if (registration.kind === "reviewRequired") return { ...registration, revision: input.revision }
  const side = (name: ComparisonSide): ComparisonRenderSide => {
    const solved = registration[name]
    const instruction =
      name === "after"
        ? mergeCropAdjustment(solved.instruction, input.residual)
        : solved.instruction
    const fit = registration.after.fit
    const projectedRegistrationPoints = fit?.references.map((reference) => ({
      ...(name === "before"
        ? reference.target
        : projectPointToTarget(instruction, reference.source)),
      name: reference.name,
    }))
    return {
      ...(solved.fit === undefined ? {} : { fit: solved.fit }),
      ...(projectedRegistrationPoints === undefined ? {} : { projectedRegistrationPoints }),
      instruction,
      neutralMargin: instructionLeavesNeutralMargin(instruction, input.pair[name].decoded),
      postResidualDisplacementPixels:
        fit !== undefined && name === "after"
          ? Math.sqrt(
              fit.references.reduce(
                (sum, reference) =>
                  sum + displacement(instruction, reference.source, reference.target) ** 2,
                0,
              ) / fit.references.length,
            )
          : Math.max(
              displacement(
                instruction,
                solved.sourceReferences.first,
                solved.targetReferences.first,
              ),
              displacement(
                instruction,
                solved.sourceReferences.second,
                solved.targetReferences.second,
              ),
            ),
      preResidualErrorPixels: solved.preResidualErrorPixels,
      provenance: solved.provenance,
      references: solved.sourceReferences,
      slot: input.pair[name],
    }
  }
  return {
    after: side("after"),
    angle: input.angle,
    before: side("before"),
    kind: "ready",
    residual: input.residual,
    revision: input.revision,
  }
}

export function scaleComparisonInstruction(
  instruction: CropInstruction,
  target: ImageSize,
): CropInstruction {
  const x = target.width / instruction.targetSize.width
  const y = target.height / instruction.targetSize.height
  if (Math.abs(x - y) > 1e-9) throw new Error("Comparison target must preserve 4:5 ratio")
  return {
    ...instruction,
    scale: instruction.scale * x,
    targetAnchor: { x: instruction.targetAnchor.x * x, y: instruction.targetAnchor.y * y },
    targetSize: target,
  }
}
