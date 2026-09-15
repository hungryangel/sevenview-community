import { type RefObject, useCallback, useLayoutEffect, useMemo, useState } from "react"

import type { ComparisonAngle, ComparisonSide } from "../domain/comparison"
import { resolveComparisonAngle } from "../domain/comparison-angle"
import type { ComparisonReferencePair } from "../domain/comparison-reference-pair"
import type { RegistrationReferences } from "../domain/comparison-registration"
import { type ComparisonSession, isRenderableComparisonSlot } from "../domain/comparison-session"
import type { CropAdjustment, Point } from "../domain/types"
import {
  buildComparisonRenderModel,
  type ComparisonRenderModel,
  EMPTY_COMPARISON_ADJUSTMENT,
  type ManualComparisonReferences,
} from "./comparison-render-model"

type ComparisonAlignmentRuntime = {
  readonly angleRef: RefObject<ComparisonAngle | null>
  readonly renderModelRef: RefObject<ComparisonRenderModel | null>
}

export function useComparisonAlignment(
  session: ComparisonSession<CanvasImageSource>,
  clearExportStatus: () => void,
  runtime: ComparisonAlignmentRuntime,
) {
  const [angleOverride, setAngleOverride] = useState<ComparisonAngle | null>(null)
  const [referenceState, setReferenceState] = useState<{
    readonly references: ManualComparisonReferences
    readonly recovery: boolean
  }>({ references: {}, recovery: false })
  const { references: manualReferences, recovery: manualRecovery } = referenceState
  const [residual, setResidualState] = useState<CropAdjustment>(EMPTY_COMPARISON_ADJUSTMENT)
  const [revision, setRevision] = useState(0)
  const angleResolution = useMemo(
    () =>
      isRenderableComparisonSlot(session.before) && isRenderableComparisonSlot(session.after)
        ? resolveComparisonAngle({
            before: session.before.kind === "ready" ? session.before.pose : null,
            after: session.after.kind === "ready" ? session.after.pose : null,
            override: angleOverride,
          })
        : null,
    [angleOverride, session.after, session.before],
  )
  const angle =
    angleResolution?.kind === "ready" ? angleResolution.angle : (angleOverride ?? "front")
  const renderModel = useMemo(
    () =>
      isRenderableComparisonSlot(session.before) &&
      isRenderableComparisonSlot(session.after) &&
      angleResolution?.kind === "ready"
        ? buildComparisonRenderModel({
            angle: angleResolution.angle,
            manualReferences,
            manualRecovery,
            pair: { before: session.before, after: session.after },
            residual,
            revision,
          })
        : null,
    [
      angleResolution,
      manualReferences,
      manualRecovery,
      residual,
      revision,
      session.after,
      session.before,
    ],
  )
  useLayoutEffect(() => {
    runtime.angleRef.current = angleResolution?.kind === "ready" ? angleResolution.angle : null
    runtime.renderModelRef.current = renderModel
  }, [angleResolution, renderModel, runtime])

  const setAngle = useCallback(
    (next: ComparisonAngle | null) => {
      runtime.angleRef.current = next
      setAngleOverride(next)
      setReferenceState({ references: {}, recovery: false })
      setResidualState(EMPTY_COMPARISON_ADJUSTMENT)
      setRevision((value) => value + 1)
      clearExportStatus()
    },
    [clearExportStatus, runtime],
  )
  const invalidateSide = useCallback(
    (side: ComparisonSide) => {
      setReferenceState((current) => ({
        ...current,
        references: current.recovery ? {} : { ...current.references, [side]: undefined },
      }))
      setResidualState(EMPTY_COMPARISON_ADJUSTMENT)
      setRevision((value) => value + 1)
      clearExportStatus()
    },
    [clearExportStatus],
  )
  const setReference = useCallback(
    (side: ComparisonSide, index: "first" | "second", point: Point) => {
      const model = runtime.renderModelRef.current
      if (model === null || model.kind !== "ready") return
      const source = model[side].slot.decoded
      const current = manualReferences[side] ?? {
        first: {
          x: model[side].references.first.x / source.width,
          y: model[side].references.first.y / source.height,
        },
        second: {
          x: model[side].references.second.x / source.width,
          y: model[side].references.second.y / source.height,
        },
      }
      setReferenceState((state) => ({
        ...state,
        references: { ...state.references, [side]: { ...current, [index]: point } },
      }))
      setRevision((value) => value + 1)
      clearExportStatus()
    },
    [clearExportStatus, manualReferences, runtime],
  )
  const setReferences = useCallback(
    (side: ComparisonSide, references: RegistrationReferences) => {
      setReferenceState((current) => ({
        recovery: true,
        references: { ...(current.recovery ? current.references : {}), [side]: references },
      }))
      setRevision((value) => value + 1)
      clearExportStatus()
    },
    [clearExportStatus],
  )
  const setReferencePair = useCallback(
    (references: ComparisonReferencePair, angle: ComparisonAngle) => {
      runtime.angleRef.current = angle
      setAngleOverride(angle)
      setReferenceState({ references, recovery: true })
      setResidualState(EMPTY_COMPARISON_ADJUSTMENT)
      setRevision((value) => value + 1)
      clearExportStatus()
    },
    [clearExportStatus, runtime],
  )
  const resetReferences = useCallback(() => {
    setReferenceState({ references: {}, recovery: false })
    setRevision((value) => value + 1)
    clearExportStatus()
  }, [clearExportStatus])
  const setResidual = useCallback(
    (next: CropAdjustment) => {
      setResidualState(next)
      setRevision((value) => value + 1)
      clearExportStatus()
    },
    [clearExportStatus],
  )
  return {
    angle,
    angleOverride,
    angleResolution,
    manualReferences,
    residual,
    renderModel,
    setAngle,
    invalidateSide,
    setReference,
    setReferencePair,
    setReferences,
    resetReferences,
    setResidual,
  }
}
