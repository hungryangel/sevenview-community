import { type ComparisonSlot, isRenderableComparisonSlot } from "../domain/comparison-session"
import type { ReadyComparisonSlot } from "./comparison-preview"

export type ComparisonEditablePair = Readonly<{
  before: ReadyComparisonSlot
  after: ReadyComparisonSlot
}>

function editableSlot(slot: ComparisonSlot<CanvasImageSource>): ReadyComparisonSlot | null {
  if (isRenderableComparisonSlot(slot)) return slot
  if (slot.kind === "error" && slot.code === "face_not_detected" && slot.decoded !== undefined)
    return { kind: "manual", file: slot.file, decoded: slot.decoded }
  return null
}

export function comparisonEditablePair(
  before: ComparisonSlot<CanvasImageSource>,
  after: ComparisonSlot<CanvasImageSource>,
): ComparisonEditablePair | null {
  const beforeSource = editableSlot(before)
  const afterSource = editableSlot(after)
  return beforeSource === null || afterSource === null
    ? null
    : { before: beforeSource, after: afterSource }
}
