import { useEffect, useRef, useState } from "react"

type AnalysisPresentationInput = {
  readonly active: boolean
  readonly generation: number
  readonly ready: boolean
  readonly revision: number
}

export function useAnalysisPresentation(input: AnalysisPresentationInput) {
  const [state, setState] = useState(() => ({
    generation: input.generation,
    hasBeenReady: input.ready,
    replay: 0,
    revision: input.revision,
    skipped: !input.active || document.hidden,
  }))
  const latestInput = useRef(input)
  latestInput.current = input
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
  const current =
    state.generation !== input.generation
      ? {
          generation: input.generation,
          hasBeenReady: input.ready,
          replay: 0,
          revision: input.revision,
          skipped: !input.active || document.hidden,
        }
      : state.revision !== input.revision
        ? {
            ...state,
            hasBeenReady: state.hasBeenReady || input.ready,
            revision: input.revision,
            skipped: state.skipped || state.hasBeenReady,
          }
        : !state.hasBeenReady && input.ready
          ? { ...state, hasBeenReady: true }
          : state
  if (current !== state) {
    setState(current)
  }

  useEffect(() => {
    const cancelWhenHidden = () => {
      if (document.hidden) {
        setState((value) => ({
          ...value,
          generation: latestInput.current.generation,
          revision: latestInput.current.revision,
          skipped: true,
        }))
      }
    }
    document.addEventListener("visibilitychange", cancelWhenHidden)
    return () => document.removeEventListener("visibilitychange", cancelWhenHidden)
  }, [])

  useEffect(() => {
    if (!input.active) {
      setState((value) => ({
        ...value,
        generation: input.generation,
        revision: input.revision,
        skipped: true,
      }))
    }
  }, [input.active, input.generation, input.revision])

  const canAnimate =
    input.active && !document.hidden && !reducedMotion && !current.skipped && input.ready
  return {
    canAnimate,
    canReplay: input.active && !document.hidden && !reducedMotion && input.ready,
    replay: current.replay,
    replayPresentation: () => {
      if (input.active && !document.hidden && !reducedMotion) {
        setState({
          generation: input.generation,
          hasBeenReady: input.ready,
          replay: current.replay + 1,
          revision: input.revision,
          skipped: false,
        })
      }
    },
    skipPresentation: () =>
      setState({
        ...current,
        generation: input.generation,
        revision: input.revision,
        skipped: true,
      }),
  }
}
