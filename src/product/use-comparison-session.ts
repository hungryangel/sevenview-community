import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { COMPARISON_SIDES, type ComparisonSide } from "../domain/comparison"
import {
  type ComparisonSession,
  type ComparisonSessionAction,
  comparisonSessionReducer,
  createComparisonSession,
} from "../domain/comparison-session"
import { releaseComparisonSlot } from "./comparison-resources"
import type {
  ComparisonSessionRuntime,
  ComparisonWorkspaceDependencies,
} from "./comparison-workspace-types"

export function useComparisonSession(dependencies: ComparisonWorkspaceDependencies) {
  const [session, setSession] = useState<ComparisonSession<CanvasImageSource>>(() =>
    createComparisonSession(),
  )
  const sessionRef = useRef(session)
  const generationRef = useRef<Record<ComparisonSide, number>>({ before: 0, after: 0 })
  const mountedRef = useRef(false)
  const analysisControllerRef = useRef<AbortController | null>(null)
  const transition = useCallback((action: ComparisonSessionAction<CanvasImageSource>) => {
    const next = comparisonSessionReducer(sessionRef.current, action)
    sessionRef.current = next
    setSession(next)
  }, [])
  const releaseSession = useCallback(() => {
    for (const side of COMPARISON_SIDES)
      releaseComparisonSlot(sessionRef.current[side], dependencies)
  }, [dependencies])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      analysisControllerRef.current?.abort()
      generationRef.current.before += 1
      generationRef.current.after += 1
      releaseSession()
      sessionRef.current = createComparisonSession()
    }
  }, [releaseSession])

  const selectFile = useCallback(
    (side: ComparisonSide, file: File) => {
      analysisControllerRef.current?.abort()
      const sides = COMPARISON_SIDES.filter(
        (candidate) => sessionRef.current[candidate].kind === "analyzing",
      )
      if (sides.length > 0) transition({ type: "cancel", sides })
      generationRef.current[side] += 1
      releaseComparisonSlot(sessionRef.current[side], dependencies)
      transition({ type: "select", side, file, previewUrl: dependencies.createPreviewUrl(file) })
    },
    [dependencies, transition],
  )

  const removeSide = useCallback(
    (side: ComparisonSide) => {
      generationRef.current[side] += 1
      releaseComparisonSlot(sessionRef.current[side], dependencies)
      transition({ type: "remove", side })
    },
    [dependencies, transition],
  )

  const reset = useCallback(() => {
    analysisControllerRef.current?.abort()
    generationRef.current.before += 1
    generationRef.current.after += 1
    releaseSession()
    transition({ type: "reset" })
  }, [releaseSession, transition])

  const beginManual = useCallback(
    (side: ComparisonSide) => {
      const slot = sessionRef.current[side]
      if (
        sessionRef.current.phase === "analyzing" ||
        slot.kind !== "error" ||
        slot.code !== "face_not_detected" ||
        slot.decoded === undefined
      )
        return
      dependencies.releasePreviewUrl(slot.previewUrl)
      transition({ type: "manual", side })
    },
    [dependencies, transition],
  )

  const runtime = useMemo<ComparisonSessionRuntime>(
    () => ({
      sessionRef,
      generationRef,
      mountedRef,
      analysisControllerRef,
      transition,
    }),
    [transition],
  )
  return { session, runtime, selectFile, removeSide, beginManual, reset }
}
