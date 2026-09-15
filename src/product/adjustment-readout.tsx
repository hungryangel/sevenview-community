import type { CropAdjustment } from "../domain/types"

// 사진 아래 한 줄 수치 판독(2026-09-03 bee): 배지가 사진을 가려서 사진 밖으로 내렸다.
// 순서는 가로 · 세로 · 회전. 부호는 항상 붙인다(가로 +=오른쪽, 세로 +=위, 회전 +=시계).
export function signedPercent(value: number): string {
  const percent = Math.round(value * 100)
  return `${percent > 0 ? "+" : ""}${percent}%`
}

export function signedDegrees(value: number): string {
  // 0.05 경계는 0에서 먼 쪽으로(−1.25 → −1.3, +1.25 → +1.3). Math.round는 음수 .5를 위로 올린다.
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * 10)) / 10
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}°`
}

type AdjustmentReadoutProps = {
  readonly adjustment: CropAdjustment
}

export function AdjustmentReadout({ adjustment }: AdjustmentReadoutProps) {
  const items: readonly {
    readonly changed: boolean
    readonly label: string
    readonly value: string
  }[] = [
    { changed: adjustment.panX !== 0, label: "가로", value: signedPercent(adjustment.panX) },
    { changed: adjustment.panY !== 0, label: "세로", value: signedPercent(adjustment.panY) },
    {
      changed: adjustment.rotationDegrees !== 0,
      label: "회전",
      value: signedDegrees(adjustment.rotationDegrees),
    },
  ]
  return (
    // <p>는 aria-label을 못 받는다(biome a11y) — 이름 있는 영역으로 둔다.
    <section aria-label="보정 수치" className="adjustment-readout">
      {items.map((item) => (
        <span className="adjustment-readout__item" data-changed={item.changed} key={item.label}>
          <span className="adjustment-readout__label">{item.label}</span>{" "}
          <span className="adjustment-readout__value">{item.value}</span>
        </span>
      ))}
    </section>
  )
}
