import { useCallback, useRef, useState } from "react"

import { advanceAnalysisJourney, beginAnalysisJourney } from "../domain/analysis-journey"
import { COMPARISON_SIDES, type ComparisonSide } from "../domain/comparison"
import type { ComparisonSession } from "../domain/comparison-session"
import { releaseComparisonBatchResults } from "./comparison-resources"
import type {
  ComparisonSessionRuntime,
  ComparisonWorkspaceDependencies,
} from "./comparison-workspace-types"

function pendingSides(session: ComparisonSession<CanvasImageSource>): readonly ComparisonSide[] {
  return COMPARISON_SIDES.filter((side) => session[side].kind === "pending")
}

export function canAnalyzeComparisonPending(
  session: ComparisonSession<CanvasImageSource>,
): boolean {
  return (
    session.phase !== "analyzing" &&
    session.before.kind !== "empty" &&
    session.after.kind !== "empty" &&
    pendingSides(session).length > 0
  )
}

export function useComparisonAnalysis(
  dependencies: ComparisonWorkspaceDependencies,
  runtime: ComparisonSessionRuntime,
) {
  const { sessionRef, generationRef, analysisControllerRef, transition } = runtime
  const [progress, setProgress] = useState(0)
  const [analysisSide, setAnalysisSide] = useState<ComparisonSide | null>(null)
  const [journey, setJourney] = useState(() => beginAnalysisJourney(0, 2))
  const journeyGenerationRef = useRef(0)

  const analyzeSides = useCallback(
    async (sides: readonly ComparisonSide[]) => {
      const selectedFiles: File[] = []
      const generations: number[] = []
      for (const side of sides) {
        const slot = sessionRef.current[side]
        if (slot.kind !== "pending" && slot.kind !== "error") return
        if (slot.kind === "error" && slot.decoded !== undefined)
          dependencies.releaseImage(slot.decoded.image)
        selectedFiles.push(slot.file)
        generations.push(generationRef.current[side])
      }
      transition({ type: "start", sides })
      analysisControllerRef.current?.abort()
      const controller = new AbortController()
      analysisControllerRef.current = controller
      const journeyGeneration = ++journeyGenerationRef.current
      setJourney(beginAnalysisJourney(journeyGeneration, sides.length))
      setProgress(0)
      setAnalysisSide(sides[0] ?? null)
      try {
        const results = await dependencies.analyzeFiles(
          selectedFiles,
          (processed, total) => {
            if (sides.every((side, index) => generationRef.current[side] === generations[index])) {
              setProgress(Math.round((processed / total) * 100))
              setAnalysisSide(sides[processed] ?? sides[sides.length - 1] ?? null)
            }
          },
          {
            signal: controller.signal,
            onStage: (event) => {
              if (event.kind !== "analyzed" || controller.signal.aborted) return
              setJourney((current) =>
                advanceAnalysisJourney(current, {
                  type: "itemDetected",
                  generation: journeyGeneration,
                  index: event.index,
                  ...(event.item.kind === "ready" &&
                  event.item.pose.registrationAnchors !== undefined
                    ? {
                        anchors: event.item.pose.registrationAnchors,
                        sourceSize: event.item.decoded,
                      }
                    : {}),
                }),
              )
            },
          },
        )
        if (controller.signal.aborted) {
          releaseComparisonBatchResults(results, dependencies)
          return
        }
        for (const [index, result] of results.entries()) {
          const side = sides[index]
          if (side === undefined || generationRef.current[side] !== generations[index]) {
            releaseComparisonBatchResults([result], dependencies)
            continue
          }
          if (result.kind === "ready") {
            const slot = sessionRef.current[side]
            if (slot.kind !== "analyzing" || slot.file !== result.file) {
              dependencies.releaseImage(result.decoded.image)
              continue
            }
            dependencies.releasePreviewUrl(slot.previewUrl)
            transition({
              type: "ready",
              side,
              file: result.file,
              decoded: result.decoded,
              pose: result.pose,
            })
          } else {
            const slot = sessionRef.current[side]
            const retain =
              result.code === "face_not_detected" &&
              result.decoded !== null &&
              slot.kind === "analyzing" &&
              slot.file === result.file
            if (slot.kind === "analyzing" && slot.file === result.file) {
              transition({
                type: "error",
                side,
                file: result.file,
                code: result.code,
                ...(retain && result.decoded !== null ? { decoded: result.decoded } : {}),
              })
            }
            if (!retain && result.decoded !== null) dependencies.releaseImage(result.decoded.image)
          }
        }
        for (const [index, side] of sides.entries()) {
          if (generationRef.current[side] !== generations[index]) continue
          const slot = sessionRef.current[side]
          if (slot.kind === "analyzing" && slot.file === selectedFiles[index]) {
            transition({ type: "error", side, file: slot.file, code: "analysis_failed" })
          }
        }
        if (!controller.signal.aborted) {
          setJourney((current) =>
            advanceAnalysisJourney(
              advanceAnalysisJourney(current, { type: "settled", generation: journeyGeneration }),
              { type: "completed", generation: journeyGeneration },
            ),
          )
        }
      } catch (error: unknown) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          return
        if (!(error instanceof Error)) throw error
        for (const [index, side] of sides.entries()) {
          if (generationRef.current[side] !== generations[index]) continue
          const slot = sessionRef.current[side]
          if (slot.kind === "analyzing" && slot.file === selectedFiles[index]) {
            transition({ type: "error", side, file: slot.file, code: "analysis_failed" })
          }
        }
        setJourney((current) =>
          advanceAnalysisJourney(current, {
            generation: journeyGeneration,
            message:
              "기기 내 분석을 완료하지 못했습니다. 원본을 유지한 채 다시 시도할 수 있습니다.",
            type: "failed",
          }),
        )
      }
      if (analysisControllerRef.current === controller) setAnalysisSide(null)
    },
    [analysisControllerRef, dependencies, generationRef, sessionRef, transition],
  )

  const analyzePending = useCallback(async () => {
    if (canAnalyzeComparisonPending(sessionRef.current))
      await analyzeSides(pendingSides(sessionRef.current))
  }, [analyzeSides, sessionRef])
  const retry = useCallback(
    async (side: ComparisonSide) => {
      if (sessionRef.current[side].kind === "error") await analyzeSides([side])
    },
    [analyzeSides, sessionRef],
  )
  const resetProgress = useCallback(() => setProgress(0), [])
  const resetPresentation = useCallback(() => {
    setProgress(0)
    setAnalysisSide(null)
    setJourney((current) =>
      advanceAnalysisJourney(current, { type: "cancelled", generation: current.generation }),
    )
  }, [])
  const cancelAnalysis = useCallback(() => {
    analysisControllerRef.current?.abort()
    const sides = COMPARISON_SIDES.filter((side) => sessionRef.current[side].kind === "analyzing")
    generationRef.current.before += 1
    generationRef.current.after += 1
    transition({ type: "cancel", sides })
    resetPresentation()
  }, [analysisControllerRef, generationRef, resetPresentation, sessionRef, transition])

  return {
    progress,
    analysisSide,
    journey,
    analyzePending,
    retry,
    cancelAnalysis,
    resetProgress,
    resetPresentation,
  }
}
