import { ArrowsHorizontal } from "@phosphor-icons/react"
import { type KeyboardEvent, useRef, useState } from "react"
import type { ComparisonViewMode } from "../domain/comparison"
import {
  COMPARISON_EXPORT_LABELS,
  COMPARISON_EXPORT_SLOTS,
  type ComparisonExportOrder,
} from "../domain/comparison-export"
import { Button } from "../ui/button"
import { useComparisonEditorDrag } from "./comparison-editor-drag"
import type { ComparisonPhotoInformationMode } from "./comparison-photo-information"
import { ComparisonPreview } from "./comparison-preview"
import type { ComparisonRenderModel } from "./comparison-render-model"
import type { ComparisonEyePrivacyController } from "./use-comparison-eye-privacy"

type Props = {
  readonly active?: boolean
  readonly disabled?: boolean
  readonly model: Extract<ComparisonRenderModel, { readonly kind: "ready" }>
  readonly mode: ComparisonViewMode
  readonly informationMode: ComparisonPhotoInformationMode
  readonly order: ComparisonExportOrder
  readonly eyePrivacy?: ComparisonEyePrivacyController
}

export function ComparisonViewerStage({
  active = true,
  disabled = false,
  model,
  mode,
  informationMode,
  order,
  eyePrivacy,
}: Props) {
  const [boundaryPercent, setBoundaryPercent] = useState(50)
  const frameRef = useRef<HTMLElement>(null)
  const drag = useComparisonEditorDrag(active && !disabled && mode === "wipe")
  const [currentSide, setCurrentSide] = useState<"before" | "after">("before")
  const sides = COMPARISON_EXPORT_SLOTS[order]
  const boundaryText = `왼쪽에서 ${boundaryPercent}% · 왼쪽 ${COMPARISON_EXPORT_LABELS[sides[0]]} · 오른쪽 ${COMPARISON_EXPORT_LABELS[sides[1]]}`
  const handleBoundaryKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!active || disabled) return
    const delta = event.shiftKey ? 10 : 1
    const changes: Readonly<Record<string, number>> = {
      ArrowLeft: boundaryPercent - delta,
      ArrowDown: boundaryPercent - delta,
      ArrowRight: boundaryPercent + delta,
      ArrowUp: boundaryPercent + delta,
      Home: 0,
      End: 100,
    }
    const next = changes[event.key]
    if (next === undefined) return
    event.preventDefault()
    setBoundaryPercent(Math.min(100, Math.max(0, next)))
  }
  const preview = (side: "before" | "after") => (
    <ComparisonPreview
      angle={model.angle}
      informationMode={informationMode}
      render={model[side]}
      side={side}
      {...(eyePrivacy === undefined ? {} : { privacy: eyePrivacy.rasterFor(side) })}
    />
  )
  return (
    <div className="comparison-viewer__stage" data-mode={mode}>
      {mode === "sideBySide" ? (
        <div className="comparison-viewer__side-by-side">
          {sides.map((side) => (
            <figure key={side}>
              {preview(side)}
              <figcaption>{COMPARISON_EXPORT_LABELS[side]}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {mode === "wipe" ? (
        <div className="comparison-viewer__wipe-section">
          <figure className="comparison-viewer__wipe" ref={frameRef}>
            <figcaption className="sr-only">시술 전후 겹쳐 보기</figcaption>
            {preview("before")}
            <div
              aria-hidden="true"
              className="comparison-viewer__wipe-after"
              style={{
                clipPath:
                  order === "beforeAfter"
                    ? `inset(0 0 0 ${boundaryPercent}%)`
                    : `inset(0 ${100 - boundaryPercent}% 0 0)`,
              }}
            >
              {preview("after")}
            </div>
            <div
              aria-disabled={!active || disabled}
              aria-label="사진 위 비교 경계"
              aria-orientation="horizontal"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={boundaryPercent}
              aria-valuetext={boundaryText}
              className="comparison-viewer__divider"
              onKeyDown={handleBoundaryKey}
              onPointerDown={(event) => {
                const bounds = frameRef.current?.getBoundingClientRect()
                if (bounds === undefined || bounds.width === 0) return
                drag.start(event, (point) =>
                  setBoundaryPercent(
                    Math.round(
                      Math.min(
                        100,
                        Math.max(0, ((point.clientX - bounds.left) / bounds.width) * 100),
                      ),
                    ),
                  ),
                )
              }}
              role="slider"
              style={{ left: `${boundaryPercent}%` }}
              tabIndex={active && !disabled ? 0 : -1}
            >
              <span>
                <ArrowsHorizontal aria-hidden="true" size={20} />
              </span>
            </div>
          </figure>
          <div className="comparison-viewer__wipe-controls">
            <div className="comparison-viewer__side-labels">
              <span>왼쪽 · {COMPARISON_EXPORT_LABELS[sides[0]]}</span>
              <span>오른쪽 · {COMPARISON_EXPORT_LABELS[sides[1]]}</span>
            </div>
            <label className="comparison-viewer__range">
              비교 경계 위치
              <input
                aria-valuetext={boundaryText}
                disabled={!active || disabled}
                max="100"
                min="0"
                onChange={(event) => setBoundaryPercent(event.currentTarget.valueAsNumber)}
                onKeyDown={handleBoundaryKey}
                type="range"
                value={boundaryPercent}
              />
            </label>
          </div>
        </div>
      ) : null}
      {mode === "toggle" ? (
        <div className="comparison-viewer__toggle">
          <div className="comparison-viewer__toggle-frame">
            {(["before", "after"] as const).map((side) => (
              <ComparisonPreview
                key={side}
                aria-hidden={currentSide !== side}
                angle={model.angle}
                className={currentSide === side ? "is-current" : ""}
                informationMode={informationMode}
                side={side}
                render={model[side]}
                {...(eyePrivacy === undefined ? {} : { privacy: eyePrivacy.rasterFor(side) })}
              />
            ))}
          </div>
          <Button
            onClick={() => setCurrentSide((side) => (side === "before" ? "after" : "before"))}
            variant="secondary"
          >
            {currentSide === "before" ? "시술 후 사진 보기" : "시술 전 사진 보기"}
          </Button>
          <p aria-live="polite" className="comparison-viewer__current">
            {currentSide === "before" ? "현재 시술 전 사진" : "현재 시술 후 사진"}
          </p>
        </div>
      ) : null}
    </div>
  )
}
