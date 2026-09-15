import { DownloadSimple } from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useRef } from "react"
import { isRenderableComparisonSlot } from "../domain/comparison-session"
import { Button } from "../ui/button"
import { AnalysisStage } from "./analysis-stage"
import { ComparisonAlignmentWorkbench } from "./comparison-alignment-workbench"
import { ComparisonAngleControl } from "./comparison-angle-control"
import { comparisonEditablePair } from "./comparison-editable-pair"
import type { ComparisonIntakeProps } from "./comparison-intake-types"
import { ComparisonNewPairAction } from "./comparison-new-pair-action"
import { comparisonPresentationItems } from "./comparison-presentation-items"
import { ComparisonReferenceEditor } from "./comparison-reference-editor"
import { ComparisonRegistrationRecovery } from "./comparison-registration-recovery"
import { COMPARISON_SIDE_LABELS, ComparisonSlotField } from "./comparison-slot-field"
import { ComparisonViewer } from "./comparison-viewer"
import { CompletionTransition } from "./completion-transition"
import { WorkspaceHeaderAction } from "./workspace-header-action"

export function ComparisonIntake(props: ComparisonIntakeProps) {
  const ready = isRenderableComparisonSlot(props.before) && isRenderableComparisonSlot(props.after)
  const hasPair = props.before.kind !== "empty" || props.after.kind !== "empty"
  const pairedEditing = props.onReferencePairApply !== undefined
  const recoverable = pairedEditing && comparisonEditablePair(props.before, props.after) !== null
  const locked = (props.analysisSide !== null && props.analysisSide !== undefined) || props.exporting
  const focusIntakeAfterResetRef = useRef(false)
  useLayoutEffect(() => {
    if (!hasPair && focusIntakeAfterResetRef.current) {
      focusIntakeAfterResetRef.current = false
    }
  }, [hasPair])
  const analysisFiles = ([props.before, props.after] as const).flatMap((slot) =>
    slot.kind === "analyzing" ? [{ previewUrl: slot.previewUrl }] : [],
  )
  const readyComparison =
    ready && props.renderModel?.kind === "ready" ? (
      <>
        <ComparisonViewer
          active={props.active !== false}
          model={props.renderModel}
          {...(props.eyePrivacy === undefined ? {} : { eyePrivacy: props.eyePrivacy })}
          order={props.displayOrder ?? "beforeAfter"}
          {...(props.onOrderChange === undefined ? {} : { onOrderChange: props.onOrderChange })}
          disabled={locked}
        />
        <ComparisonReferenceEditor
          pairedEditing={pairedEditing}
          active={props.active !== false}
          disabled={locked}
          model={props.renderModel}
          onReferenceChange={props.onReferenceChange ?? (() => undefined)}
          onResetReferences={props.onResetReferences ?? (() => undefined)}
          onResidualChange={props.onResidualChange ?? (() => undefined)}
        />
      </>
    ) : null
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  const wasReadyRef = useRef(ready)
  useEffect(() => {
    if (
      props.active !== false &&
      document.visibilityState === "visible" &&
      ready &&
      !wasReadyRef.current
    ) {
      resultHeadingRef.current?.focus()
    }
    wasReadyRef.current = ready
  }, [props.active, ready])
  const slots = (showReadyPreview: boolean) => (
    <div className="comparison-intake__slots">
      <ComparisonSlotField
        disabled={locked}
        focusSelect={!hasPair && focusIntakeAfterResetRef.current}
        onRemove={() => props.onRemove("before")}
        onRetry={() => props.onRetry("before")}
        {...(props.onManual === undefined ? {} : { onManual: () => props.onManual?.("before") })}
        onSelect={(file) => props.onSelect("before", file)}
        side="before"
        showReadyPreview={showReadyPreview}
        slot={props.before}
      />
      <ComparisonSlotField
        disabled={locked}
        onRemove={() => props.onRemove("after")}
        onRetry={() => props.onRetry("after")}
        {...(props.onManual === undefined ? {} : { onManual: () => props.onManual?.("after") })}
        onSelect={(file) => props.onSelect("after", file)}
        side="after"
        showReadyPreview={showReadyPreview}
        slot={props.after}
      />
    </div>
  )
  const controls = (
    <div className="comparison-intake__controls">
      <ComparisonAngleControl
        resolution={props.angleResolution ?? null}
        override={props.angleOverride ?? null}
        disabled={locked}
        onChange={props.onAngleChange}
      />
      <Button disabled={!props.canAnalyze} onClick={props.onAnalyze} variant="primary">
        두 사진 정렬
      </Button>
    </div>
  )
  const content = (
    <>
      <header className="comparison-workspace__heading">
        <span className="eyebrow">로컬 전후 비교</span>
        <h1 id="comparison-heading" ref={resultHeadingRef} tabIndex={-1}>
          {ready ? "전후 비교" : "시술 전후 사진 비교"}
        </h1>
        <p>같은 사람·같은 각도·표정인지 직접 확인하세요</p>
        <p>촬영 조건 비교용이며 시술 효과를 판정하지 않습니다</p>
        <div className="comparison-workspace__export">
          <Button
            aria-busy={props.exporting}
            disabled={!props.canExport}
            onClick={props.onExport}
            variant="primary"
          >
            <DownloadSimple aria-hidden="true" size={17} />
            {props.exporting ? "저장 중" : "비교 이미지 저장"}
          </Button>
          {hasPair && props.onReset !== undefined ? (
            <WorkspaceHeaderAction active={props.active !== false}>
              <ComparisonNewPairAction
                active={props.active !== false}
                disabled={locked}
                exported={props.exported === true}
                onStartNew={() => {
                  focusIntakeAfterResetRef.current = true
                  props.onReset?.()
                }}
              />
            </WorkspaceHeaderAction>
          ) : null}
          {props.exportMessage === null ? null : (
            <p
              aria-live={props.active === false ? "off" : "polite"}
              className="comparison-workspace__export-message"
            >
              {props.exportMessage}
            </p>
          )}
        </div>
      </header>
      {props.analysisJourney !== undefined && analysisFiles.length > 0 ? (
        <AnalysisStage
          active={props.active !== false}
          files={analysisFiles}
          journey={props.analysisJourney}
          onCancel={props.onCancelAnalysis ?? (() => undefined)}
        />
      ) : readyComparison !== null && props.renderModel?.kind === "ready" ? (
        props.analysisJourney === undefined ||
        props.before.kind === "manual" ||
        props.after.kind === "manual" ? (
          readyComparison
        ) : (
          <CompletionTransition
            active={props.active !== false}
            items={comparisonPresentationItems(props.renderModel)}
            journey={props.analysisJourney}
            revision={props.renderModel.revision}
          >
            {readyComparison}
          </CompletionTransition>
        )
      ) : recoverable ? null : (
        slots(true)
      )}
      <ComparisonAlignmentWorkbench props={props} disabled={locked} />
      {pairedEditing ? null : <ComparisonRegistrationRecovery props={props} disabled={locked} />}
      {!pairedEditing && ready && props.angleResolution?.kind === "reviewRequired" ? (
        <ComparisonAngleControl
          resolution={props.angleResolution}
          override={props.angleOverride ?? null}
          disabled={locked}
          onChange={props.onAngleChange}
        />
      ) : null}
      {ready || recoverable ? (
        <details className="comparison-intake__adjustments">
          <summary>사진·각도 조정</summary>
          {props.angleResolution?.kind === "reviewRequired" ? null : controls}
          {slots(false)}
        </details>
      ) : (
        controls
      )}
      <p
        aria-live={props.active === false ? "off" : "polite"}
        className="comparison-workspace__progress"
      >
        {props.analysisSide !== null && props.analysisSide !== undefined
          ? `${COMPARISON_SIDE_LABELS[props.analysisSide]} 기기 내 분석 ${props.progress}%`
          : ""}
      </p>
      {props.intakeMessage === null || props.intakeMessage === undefined ? null : (
        <p
          aria-live={props.active === false ? "off" : "polite"}
          className="comparison-workspace__drop-guidance"
        >
          {props.intakeMessage}
        </p>
      )}
    </>
  )
  return props.embedded ? (
    <section className="comparison-workspace">{content}</section>
  ) : (
    <main className="comparison-workspace" id="main-content">
      {content}
    </main>
  )
}
