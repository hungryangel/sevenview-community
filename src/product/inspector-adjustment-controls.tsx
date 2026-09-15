import { Button } from "../ui/button"
import { InspectorControl } from "../ui/inspector-control"
import { RotationControl } from "../ui/rotation-control"
import type { InspectorPanelProps } from "./inspector-panel"
import type { InspectorLeveling } from "./use-inspector-leveling"

type Props = Pick<
  InspectorPanelProps,
  | "photo"
  | "showCropGuide"
  | "showCenterGuide"
  | "showEyeGuide"
  | "onShowCropGuide"
  | "onShowCenterGuide"
  | "onShowEyeGuide"
> & { readonly level: InspectorLeveling }
export function InspectorAdjustmentControls({
  photo,
  showCropGuide,
  showCenterGuide,
  showEyeGuide,
  onShowCropGuide,
  onShowCenterGuide,
  onShowEyeGuide,
  level,
}: Props) {
  const { adjustment } = photo
  const {
    change,
    leveling,
    levelPoints,
    levelPending,
    levelNote,
    resetLevelPoints,
    applyLevel,
    cancelLevel,
    setLeveling,
    setLevelNote,
  } = level
  return (
    <>
      <div className="inspector-panel__controls">
        <InspectorControl
          defaultValue={0}
          label="가로 위치"
          max={20}
          min={-20}
          onChange={(value) => change({ panX: value / 100 })}
          onReset={() => change({ panX: 0 })}
          step={1}
          unit="%"
          value={Math.round(adjustment.panX * 100)}
        />
        <InspectorControl
          defaultValue={0}
          label="세로 위치"
          max={20}
          min={-20}
          onChange={(value) => change({ panY: value / 100 })}
          onReset={() => change({ panY: 0 })}
          step={1}
          unit="%"
          value={Math.round(adjustment.panY * 100)}
        />
        <RotationControl
          max={12}
          min={-12}
          onChange={(value) => change({ rotationDegrees: value })}
          onReset={() => change({ rotationDegrees: 0 })}
          value={adjustment.rotationDegrees}
        />
        <div className="inspector-panel__level">
          <Button
            aria-pressed={leveling}
            onClick={() => {
              if (leveling) {
                cancelLevel()
                return
              }
              resetLevelPoints()
              setLevelNote(null)
              setLeveling(true)
            }}
            variant="secondary"
          >
            기준선 2점으로 수평
          </Button>
          {levelPending === null ? (
            <small>
              {leveling
                ? levelPoints.length === 0
                  ? "미리보기에서 기준선의 첫 점을 누르세요 (측면: 귓구멍 위 이주 상단 → 눈확 아래점 = FH 평면). 확대경으로 정확히 찍을 수 있습니다."
                  : "두 번째 점을 누르세요. 선을 그어 보인 뒤 적용 여부를 묻습니다."
                : (levelNote ?? "두 점을 찍으면 그 선이 수평이 됩니다 (예: FH 평면, 동공선).")}
            </small>
          ) : (
            <section aria-label="2점 수평 확인" className="inspector-panel__level-confirm">
              <strong>
                두 점을 잇는 선을 수평으로: 회전 {levelPending.rotationDegrees.toFixed(1)}°
              </strong>
              <p>
                {levelPending.clipped ? "회전 범위 ±12°에 맞춰 잘립니다. " : ""}
                이렇게 적용할까요?
              </p>
              <div>
                <Button onClick={cancelLevel} variant="quiet">
                  취소
                </Button>
                <Button onClick={resetLevelPoints} variant="secondary">
                  다시 찍기
                </Button>
                <Button onClick={applyLevel} variant="primary">
                  적용
                </Button>
              </div>
            </section>
          )}
        </div>
        <InspectorControl
          defaultValue={100}
          hint="권장 90~110%"
          label="크롭 배율"
          max={120}
          min={80}
          onChange={(value) => change({ scaleMultiplier: value / 100 })}
          onReset={() => change({ scaleMultiplier: 1 })}
          step={1}
          unit="%"
          value={Math.round(adjustment.scaleMultiplier * 100)}
        />
        <p className="inspector-panel__crop-scale-help">
          크롭 배율은 프레임 안 얼굴 크기와 모든 저장 결과를 바꿉니다
        </p>
      </div>
      <fieldset className="inspector-panel__guides">
        <legend>가이드 표시</legend>
        <label>
          <input
            checked={showCropGuide}
            onChange={(event) => onShowCropGuide(event.currentTarget.checked)}
            type="checkbox"
          />
          자르기 영역
        </label>
        <label>
          <input
            checked={showCenterGuide}
            onChange={(event) => onShowCenterGuide(event.currentTarget.checked)}
            type="checkbox"
          />
          중심선
        </label>
        <label>
          <input
            checked={showEyeGuide}
            onChange={(event) => onShowEyeGuide(event.currentTarget.checked)}
            type="checkbox"
          />
          눈높이 기준선
        </label>
      </fieldset>
    </>
  )
}
