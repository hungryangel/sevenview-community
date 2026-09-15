import { ArrowsLeftRight, Images } from "@phosphor-icons/react"

export type WorkMode = "sevenView" | "beforeAfter"

type WorkModePickerProps = {
  readonly embedded?: boolean
  readonly onSelect: (mode: WorkMode) => void
}

export function WorkModePicker({ embedded = false, onSelect }: WorkModePickerProps) {
  const content = (
    <>
      <div className="work-mode-picker__heading">
        <span className="eyebrow">작업 유형</span>
        <h1>어떤 사진을 정리할까요?</h1>
        <p>사진은 선택한 작업 동안 이 브라우저 안에서만 처리됩니다.</p>
      </div>
      <div className="work-mode-picker__options">
        <button onClick={() => onSelect("sevenView")} type="button">
          <Images aria-hidden="true" size={28} />
          <strong>여러 각도 사진 정리</strong>
          <span>성형외과·임상 촬영 세트</span>
        </button>
        <button onClick={() => onSelect("beforeAfter")} type="button">
          <ArrowsLeftRight aria-hidden="true" size={28} />
          <strong>시술 전후 사진 비교</strong>
          <span>피부과·리프팅·에너지 장비</span>
        </button>
      </div>
    </>
  )
  return embedded ? (
    <section className="work-mode-picker">{content}</section>
  ) : (
    <main className="work-mode-picker" id="main-content">
      {content}
    </main>
  )
}
