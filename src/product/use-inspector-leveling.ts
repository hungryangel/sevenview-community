import { useState } from "react"
import type { CropAdjustment, Point } from "../domain/types"
import { type LevelResult, rotationToLevel } from "./level-by-points"

export function useInspectorLeveling(
  adjustment: CropAdjustment,
  onUpdate: (adjustment: CropAdjustment) => void,
) {
  // 기준선 2점 수평 보조(2026-09-03): 미리보기에서 두 점을 찍으면 그 선이 수평이 되게 회전한다.
  // 두 점을 찍으면 바로 돌리지 않고 선을 그어 보인 뒤 "이렇게 적용할까요?"를 거친다(bee 지적).
  const [leveling, setLeveling] = useState(false)
  const [levelPoints, setLevelPoints] = useState<readonly Point[]>([])
  const [levelPending, setLevelPending] = useState<LevelResult | null>(null)
  const [levelNote, setLevelNote] = useState<string | null>(null)
  const change = (patch: Partial<CropAdjustment>) => onUpdate({ ...adjustment, ...patch })
  const resetLevelPoints = () => {
    setLevelPoints([])
    setLevelPending(null)
  }
  const pickLevelPoint = (point: Point) => {
    const next = [...levelPoints, point]
    setLevelPoints(next)
    const [from, to] = next
    if (next.length === 2 && from !== undefined && to !== undefined) {
      setLevelPending(rotationToLevel(adjustment.rotationDegrees, from, to))
    }
  }
  const applyLevel = () => {
    if (levelPending === null) {
      return
    }
    change({ rotationDegrees: levelPending.rotationDegrees })
    setLevelNote(
      `기준선 기준 ${levelPending.rotationDegrees.toFixed(1)}° 적용${levelPending.clipped ? " · 회전 범위 ±12°에 맞춰 잘렸습니다" : ""}`,
    )
    resetLevelPoints()
    setLeveling(false)
  }
  const cancelLevel = () => {
    resetLevelPoints()
    setLeveling(false)
    setLevelNote(null)
  }
  const levelLine =
    levelPoints.length === 2 && levelPoints[0] !== undefined && levelPoints[1] !== undefined
      ? ([levelPoints[0], levelPoints[1]] as const)
      : undefined

  return {
    leveling,
    levelPoints,
    levelPending,
    levelNote,
    change,
    resetLevelPoints,
    pickLevelPoint,
    applyLevel,
    cancelLevel,
    levelLine,
    setLeveling,
    setLevelNote,
  }
}
export type InspectorLeveling = ReturnType<typeof useInspectorLeveling>
