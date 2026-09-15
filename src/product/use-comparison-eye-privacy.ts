import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ComparisonSide } from "../domain/comparison"
import {
  createDetectedEyePrivacyMask,
  createManualEyePrivacyMask,
  type EyePrivacyMask,
  type EyePrivacyRaster,
  eyePrivacyIdentity,
} from "../domain/comparison-eye-privacy"
import type { ComparisonSession } from "../domain/comparison-session"
import type { Rect } from "../domain/types"

type Input = {
  readonly active: boolean
  readonly busy: boolean
  readonly clearExportStatus: () => void
  readonly isBusy?: () => boolean
  readonly generations: Readonly<Record<ComparisonSide, number>>
  readonly session: ComparisonSession<CanvasImageSource>
}

type ManualBinding = {
  readonly file: File
  readonly generation: number
  readonly image: CanvasImageSource
  readonly mask: EyePrivacyMask
}

type EditBinding = Omit<ManualBinding, "mask">

const EMPTY_RECT: Rect = { left: 0.2, top: 0.35, right: 0.8, bottom: 0.55 }

function enclosingRect(mask: EyePrivacyMask | null): Rect {
  if (mask === null) return EMPTY_RECT
  return {
    left: Math.min(...mask.regions.map(({ left }) => left)),
    top: Math.min(...mask.regions.map(({ top }) => top)),
    right: Math.max(...mask.regions.map(({ right }) => right)),
    bottom: Math.max(...mask.regions.map(({ bottom }) => bottom)),
  }
}

function decodedSlot(session: Input["session"], side: ComparisonSide) {
  const slot = session[side]
  if (slot.kind === "ready" || slot.kind === "manual") return slot
  return null
}

export function useComparisonEyePrivacy(input: Input) {
  const [enabled, setEnabledState] = useState(false)
  const [revision, setRevision] = useState(0)
  const [manual, setManual] = useState<Partial<Record<ComparisonSide, ManualBinding>>>({})
  const [editingSide, setEditingSide] = useState<ComparisonSide | null>(null)
  const [editBinding, setEditBinding] = useState<EditBinding | null>(null)
  const [draft, setDraft] = useState<Rect>(EMPTY_RECT)
  const runtimeRef = useRef(input)
  useLayoutEffect(() => {
    runtimeRef.current = input
  }, [input])
  useLayoutEffect(() => {
    if (editingSide === null || editBinding === null) return
    const slot = decodedSlot(input.session, editingSide)
    if (
      !input.active ||
      slot === null ||
      slot.file !== editBinding.file ||
      slot.decoded.image !== editBinding.image ||
      input.generations[editingSide] !== editBinding.generation
    ) {
      setEditingSide(null)
      setEditBinding(null)
    }
  }, [editBinding, editingSide, input.active, input.generations, input.session])

  const maskFor = useCallback(
    (side: ComparisonSide): EyePrivacyMask | null => {
      const slot = decodedSlot(input.session, side)
      if (slot === null) return null
      const bound = manual[side]
      if (
        bound !== undefined &&
        bound.file === slot.file &&
        bound.image === slot.decoded.image &&
        bound.generation === input.generations[side]
      )
        return bound.mask
      return slot.kind === "ready" && slot.pose.landmarkGeometry !== undefined
        ? createDetectedEyePrivacyMask(slot.pose.landmarkGeometry.named)
        : null
    },
    [input.generations, input.session, manual],
  )
  const masks = useMemo(() => ({ before: maskFor("before"), after: maskFor("after") }), [maskFor])
  const complete = masks.before !== null && masks.after !== null
  const touch = useCallback(() => {
    setRevision((value) => value + 1)
    input.clearExportStatus()
  }, [input.clearExportStatus])
  const setEnabled = useCallback(
    (next: boolean) => {
      if (!input.active || input.busy || input.isBusy?.() === true || enabled === next) return false
      setEnabledState(next)
      setEditingSide(null)
      touch()
      return true
    },
    [enabled, input.active, input.busy, input.isBusy, touch],
  )
  const beginEdit = useCallback(
    (side: ComparisonSide) => {
      const slot = decodedSlot(input.session, side)
      if (!input.active || input.busy || input.isBusy?.() === true || slot === null) return false
      setDraft(enclosingRect(masks[side]))
      setEditingSide(side)
      setEditBinding({
        file: slot.file,
        generation: input.generations[side],
        image: slot.decoded.image,
      })
      return true
    },
    [input.active, input.busy, input.generations, input.isBusy, input.session, masks],
  )
  const applyDraft = useCallback(() => {
    const latest = runtimeRef.current
    if (
      editingSide === null ||
      editBinding === null ||
      !latest.active ||
      latest.busy ||
      latest.isBusy?.() === true
    )
      return false
    const slot = decodedSlot(latest.session, editingSide)
    const mask = createManualEyePrivacyMask(draft)
    if (
      slot === null ||
      mask === null ||
      slot.file !== editBinding.file ||
      slot.decoded.image !== editBinding.image ||
      latest.generations[editingSide] !== editBinding.generation
    )
      return false
    setManual((current) => ({
      ...current,
      [editingSide]: {
        file: slot.file,
        generation: latest.generations[editingSide],
        image: slot.decoded.image,
        mask,
      },
    }))
    setEditingSide(null)
    setEditBinding(null)
    touch()
    return true
  }, [draft, editBinding, editingSide, touch])
  const rasterFor = useCallback(
    (side: ComparisonSide): EyePrivacyRaster => {
      if (!enabled) return { enabled: false }
      const slot = decodedSlot(input.session, side)
      return {
        enabled: true,
        mask: masks[side],
        sourceSize: slot === null ? { width: 0, height: 0 } : slot.decoded,
      }
    },
    [enabled, input.session, masks],
  )
  const reset = useCallback(() => {
    setEnabledState(false)
    setManual({})
    setEditingSide(null)
    setEditBinding(null)
    setDraft(EMPTY_RECT)
    touch()
  }, [touch])
  return {
    enabled,
    revision,
    identity: eyePrivacyIdentity(enabled, revision, input.generations),
    masks,
    complete,
    canExport: !enabled || complete,
    editingSide,
    draft,
    setDraft,
    setEnabled,
    beginEdit,
    applyDraft,
    cancelEdit: () => {
      setEditingSide(null)
      setEditBinding(null)
    },
    reset,
    rasterFor,
  }
}

export type ComparisonEyePrivacyController = ReturnType<typeof useComparisonEyePrivacy>
