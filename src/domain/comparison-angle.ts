import type { ComparisonAngle } from "./comparison"
import type { PhotoPose, ViewId } from "./types"
import { suggestViewForPose } from "./view-plausibility"

// Comparison resolves yaw only; expression and pitch views collapse to front in this module.
const YAW_ANGLES = {
  front: "front",
  frontSmile: "front",
  chinUp: "front",
  crownDown: "front",
  rightOblique: "rightOblique",
  leftOblique: "leftOblique",
  rightProfile: "rightProfile",
  leftProfile: "leftProfile",
} as const satisfies Record<ViewId, ComparisonAngle>

export type ComparisonAngleInput = {
  readonly before: PhotoPose | null
  readonly after: PhotoPose | null
  readonly override: ComparisonAngle | null
}

export type ComparisonAngleResolution =
  | {
      readonly kind: "ready"
      readonly angle: ComparisonAngle
      readonly before: ComparisonAngle | null
      readonly after: ComparisonAngle | null
      readonly provenance: "automatic" | "manual"
    }
  | {
      readonly kind: "reviewRequired"
      readonly reason: "angle_mismatch" | "invalid_pose" | "manual_direction_required"
      readonly before: ComparisonAngle | null
      readonly after: ComparisonAngle | null
    }

function inferAngle(pose: PhotoPose): ComparisonAngle | null {
  if (!Number.isFinite(pose.yawScore) || !Number.isFinite(pose.pitchScore)) return null
  return YAW_ANGLES[suggestViewForPose(pose, pose.pitchScore)]
}

export function resolveComparisonAngle(input: ComparisonAngleInput): ComparisonAngleResolution {
  const before = input.before === null ? null : inferAngle(input.before)
  const after = input.after === null ? null : inferAngle(input.after)
  if ((input.before !== null && before === null) || (input.after !== null && after === null))
    return { kind: "reviewRequired", reason: "invalid_pose", before, after }
  if (input.before === null || input.after === null) {
    return input.override === null
      ? { kind: "reviewRequired", reason: "manual_direction_required", before, after }
      : { kind: "ready", angle: input.override, before, after, provenance: "manual" }
  }
  if (before === null || after === null) {
    return { kind: "reviewRequired", reason: "invalid_pose", before, after }
  }
  if (input.override === null && before !== after) {
    return { kind: "reviewRequired", reason: "angle_mismatch", before, after }
  }
  return {
    kind: "ready",
    angle: input.override ?? before,
    before,
    after,
    provenance: input.override === null ? "automatic" : "manual",
  }
}
