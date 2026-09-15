import type { DecodedPhoto } from "../services/analyze-batch"
import type { ComparisonSide } from "./comparison"
import type { AnalysisFailureCode, PhotoPose } from "./types"

export type ComparisonSessionPhase = "intake" | "analyzing" | "review"

export type ComparisonSlot<TImage> =
  | { readonly kind: "empty" }
  | { readonly kind: "pending"; readonly file: File; readonly previewUrl: string }
  | { readonly kind: "analyzing"; readonly file: File; readonly previewUrl: string }
  | {
      readonly kind: "ready"
      readonly file: File
      readonly decoded: DecodedPhoto<TImage>
      readonly pose: PhotoPose
    }
  | {
      readonly kind: "manual"
      readonly file: File
      readonly decoded: DecodedPhoto<TImage>
    }
  | {
      readonly kind: "error"
      readonly file: File
      readonly previewUrl: string
      readonly code: AnalysisFailureCode
      readonly decoded?: DecodedPhoto<TImage>
    }

export type ComparisonSession<TImage> = {
  readonly phase: ComparisonSessionPhase
  readonly before: ComparisonSlot<TImage>
  readonly after: ComparisonSlot<TImage>
}

export type ComparisonSessionAction<TImage> =
  | {
      readonly type: "select"
      readonly side: ComparisonSide
      readonly file: File
      readonly previewUrl: string
    }
  | { readonly type: "start"; readonly sides: readonly ComparisonSide[] }
  | {
      readonly type: "ready"
      readonly side: ComparisonSide
      readonly file: File
      readonly decoded: DecodedPhoto<TImage>
      readonly pose: PhotoPose
    }
  | {
      readonly type: "error"
      readonly side: ComparisonSide
      readonly file: File
      readonly code: AnalysisFailureCode
      readonly decoded?: DecodedPhoto<TImage>
    }
  | { readonly type: "manual"; readonly side: ComparisonSide }
  | { readonly type: "reset" }
  | { readonly type: "remove"; readonly side: ComparisonSide }
  | { readonly type: "cancel"; readonly sides: readonly ComparisonSide[] }

export class ComparisonTransitionError extends Error {
  readonly name = "ComparisonTransitionError"

  constructor(
    readonly action: ComparisonSessionAction<unknown>["type"],
    readonly slotKind: ComparisonSlot<unknown>["kind"],
  ) {
    super(`Invalid comparison transition: ${action} from ${slotKind}`)
  }
}

const EMPTY_SLOT = { kind: "empty" } as const

export function createComparisonSession<TImage>(): ComparisonSession<TImage> {
  return { phase: "intake", before: EMPTY_SLOT, after: EMPTY_SLOT }
}

function sessionPhase<TImage>(
  before: ComparisonSlot<TImage>,
  after: ComparisonSlot<TImage>,
): ComparisonSessionPhase {
  if (before.kind === "analyzing" || after.kind === "analyzing") {
    return "analyzing"
  }
  if (
    before.kind === "ready" ||
    before.kind === "manual" ||
    before.kind === "error" ||
    after.kind === "ready" ||
    after.kind === "manual" ||
    after.kind === "error"
  ) {
    return "review"
  }
  return "intake"
}

function withSlot<TImage>(
  state: ComparisonSession<TImage>,
  side: ComparisonSide,
  slot: ComparisonSlot<TImage>,
): ComparisonSession<TImage> {
  const before = side === "before" ? slot : state.before
  const after = side === "after" ? slot : state.after
  return { phase: sessionPhase(before, after), before, after }
}

function startSlot<TImage>(slot: ComparisonSlot<TImage>): ComparisonSlot<TImage> {
  switch (slot.kind) {
    case "pending":
    case "error":
      return { kind: "analyzing", file: slot.file, previewUrl: slot.previewUrl }
    case "empty":
    case "analyzing":
    case "ready":
    case "manual":
      throw new ComparisonTransitionError("start", slot.kind)
  }
}

function cancelSlot<TImage>(slot: ComparisonSlot<TImage>): ComparisonSlot<TImage> {
  if (slot.kind !== "analyzing") return slot
  return { kind: "pending", file: slot.file, previewUrl: slot.previewUrl }
}

export function comparisonSessionReducer<TImage>(
  state: ComparisonSession<TImage>,
  action: ComparisonSessionAction<TImage>,
): ComparisonSession<TImage> {
  switch (action.type) {
    case "select":
      return withSlot(state, action.side, {
        kind: "pending",
        file: action.file,
        previewUrl: action.previewUrl,
      })
    case "start": {
      if (action.sides.length === 0) {
        throw new ComparisonTransitionError("start", "empty")
      }
      let next = state
      for (const side of action.sides) {
        next = withSlot(next, side, startSlot(next[side]))
      }
      return next
    }
    case "ready": {
      const current = state[action.side]
      if (current.kind !== "analyzing" || current.file !== action.file) {
        throw new ComparisonTransitionError("ready", current.kind)
      }
      return withSlot(state, action.side, {
        kind: "ready",
        file: action.file,
        decoded: action.decoded,
        pose: action.pose,
      })
    }
    case "error": {
      const current = state[action.side]
      if (current.kind !== "analyzing" || current.file !== action.file) {
        throw new ComparisonTransitionError("error", current.kind)
      }
      return withSlot(state, action.side, {
        kind: "error",
        file: current.file,
        previewUrl: current.previewUrl,
        code: action.code,
        ...(action.decoded === undefined ? {} : { decoded: action.decoded }),
      })
    }
    case "manual": {
      const current = state[action.side]
      if (
        current.kind !== "error" ||
        current.code !== "face_not_detected" ||
        current.decoded === undefined
      )
        throw new ComparisonTransitionError("manual", current.kind)
      return withSlot(state, action.side, {
        kind: "manual",
        file: current.file,
        decoded: current.decoded,
      })
    }
    case "reset":
      return createComparisonSession()
    case "remove":
      return withSlot(state, action.side, EMPTY_SLOT)
    case "cancel": {
      let next = state
      for (const side of action.sides) next = withSlot(next, side, cancelSlot(next[side]))
      return next
    }
  }
}

export function isComparisonExportReady<TImage>(
  session: ComparisonSession<TImage>,
): session is ComparisonSession<TImage> & {
  readonly before: Extract<ComparisonSlot<TImage>, { readonly kind: "ready" }>
  readonly after: Extract<ComparisonSlot<TImage>, { readonly kind: "ready" }>
} {
  return session.before.kind === "ready" && session.after.kind === "ready"
}

export type RenderableComparisonSlot<TImage> = Extract<
  ComparisonSlot<TImage>,
  { readonly kind: "ready" | "manual" }
>

export function isRenderableComparisonSlot<TImage>(
  slot: ComparisonSlot<TImage>,
): slot is RenderableComparisonSlot<TImage> {
  return slot.kind === "ready" || slot.kind === "manual"
}
