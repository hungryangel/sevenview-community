import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "../ui/button"
import { ComparisonAlignmentDialog } from "./comparison-alignment-dialog"
import type { ComparisonEditablePair } from "./comparison-editable-pair"
import { comparisonEditablePair } from "./comparison-editable-pair"
import type { ComparisonIntakeProps } from "./comparison-intake-types"

export function ComparisonAlignmentWorkbench({
  props,
  disabled,
}: {
  readonly props: ComparisonIntakeProps
  readonly disabled: boolean
}) {
  const pair = useMemo(
    () => comparisonEditablePair(props.before, props.after),
    [props.before, props.after],
  )
  const angleKey =
    props.angleResolution?.kind === "ready"
      ? props.angleResolution.angle
      : (props.angleOverride ?? null)
  const [opened, setOpened] = useState<{
    readonly pair: ComparisonEditablePair
    readonly angleKey: typeof angleKey
  } | null>(null)
  const previous = useRef<ComparisonEditablePair | null>(null)
  const needsRecovery = pair !== null && props.renderModel?.kind !== "ready"
  const active = props.active !== false
  useEffect(() => {
    if (!active || disabled || pair === null) {
      setOpened(null)
      return
    }
    const changed =
      previous.current?.before.decoded !== pair.before.decoded ||
      previous.current?.after.decoded !== pair.after.decoded
    if (changed) setOpened(needsRecovery ? { pair, angleKey } : null)
    else setOpened((current) => (current?.angleKey === angleKey ? current : null))
    previous.current = pair
  }, [active, disabled, pair, needsRecovery, angleKey])
  if (pair === null || props.onReferencePairApply === undefined) return null
  return (
    <section className="comparison-alignment-workbench" aria-label="정렬 확인">
      {needsRecovery ? (
        <p role="status">자동 정렬을 확인하지 못했습니다. 두 사진의 같은 부위를 직접 맞춰주세요.</p>
      ) : null}
      <Button
        disabled={disabled}
        onClick={() => setOpened({ pair, angleKey })}
        variant={needsRecovery ? "primary" : "secondary"}
      >
        {needsRecovery ? "두 사진 기준점 맞추기" : "정렬 수정"}
      </Button>
      {opened?.pair.before.decoded === pair.before.decoded &&
      opened?.pair.after.decoded === pair.after.decoded &&
      opened.angleKey === angleKey &&
      active &&
      !disabled ? (
        <ComparisonAlignmentDialog
          pair={pair}
          angle={props.angleResolution?.kind === "ready" ? props.angleResolution.angle : null}
          initialReferences={props.manualReferences ?? {}}
          active={active}
          disabled={disabled}
          onApply={(references, angle) =>
            props.onReferencePairApply?.(pair, references, angle) ?? false
          }
          onClose={() => setOpened(null)}
        />
      ) : null}
    </section>
  )
}
