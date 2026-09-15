import type { ReactNode } from "react"
import type { AnalysisJourney } from "../domain/analysis-journey"
import {
  CompletionPresentationFrame,
  type CompletionPresentationItem,
  completionPresentationItemKey,
} from "./completion-presentation-frame"
import { useAnalysisPresentation } from "./use-analysis-presentation"

type CompletionTransitionProps = {
  readonly active: boolean
  readonly children: ReactNode
  readonly journey: AnalysisJourney
  readonly items?: readonly CompletionPresentationItem[]
  readonly revision?: number
}

export function CompletionTransition({
  active,
  children,
  journey,
  items = [],
  revision = 0,
}: CompletionTransitionProps) {
  const presentation = useAnalysisPresentation({
    active,
    generation: journey.generation,
    ready: journey.kind === "complete" && items.length > 0,
    revision,
  })
  const detectedItems = journey.items.filter((item) => item.anchors !== null).length
  const reviewItems = journey.totalItems - detectedItems
  const completionCopy =
    items.length === 0
      ? "분석 종료 · 자동 크롭 없음 · 수동 복구가 필요합니다."
      : `자동 정렬 완료 · 실제 기준점 ${detectedItems}장 · 확인 필요 ${reviewItems}장 · 방향과 크롭을 확인해 주세요.`
  return (
    <section className="completion-transition">
      {children}
      {presentation.canAnimate ? (
        <section
          aria-label="실제 원본에서 최종 크롭으로 전환"
          className="completion-transition__presentation"
          key={`${journey.generation}-${presentation.replay}`}
        >
          {items.map((item) => (
            <CompletionPresentationFrame item={item} key={completionPresentationItemKey(item)} />
          ))}
          <button
            className="button button--quiet completion-transition__skip"
            onClick={presentation.skipPresentation}
            type="button"
          >
            전환 건너뛰기
          </button>
        </section>
      ) : null}
      {journey.kind === "complete" ? (
        <span
          className="sr-only"
          aria-live={active && !document.hidden ? "polite" : "off"}
          role="status"
        >
          {completionCopy}
        </span>
      ) : null}
    </section>
  )
}
