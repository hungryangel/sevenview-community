export const USAGE_GUIDE_STEPS = [
  ["사진을 넣습니다", "끌어 놓거나 파일을 선택합니다. JPG · PNG · WebP, 1~12장."],
  ["기기에서 분석합니다", "선택한 뷰 세트에 맞춰 방향과 4:5 크롭을 제안합니다."],
  ["직접 검토합니다", "방향, 위치, 회전과 크롭을 확인하고 필요한 사진을 수정합니다."],
  ["저장합니다", "세션명을 넣고 PNG · PDF · PPTX 중 필요한 형식을 고릅니다."],
] as const

export const NEVER_SENT = ["사진", "환자 라벨", "파일명", "촬영 시각 원값"] as const

export function UsageGuide() {
  return <div className="usage-guide">
    <section aria-labelledby="usage-start-title" className="help-surface__section"><h3 id="usage-start-title">시작하기</h3><ol className="usage-guide__steps">{USAGE_GUIDE_STEPS.map(([title, body]) => <li key={title}><strong>{title}</strong><span>{body}</span></li>)}</ol><p className="usage-guide__note">자동 제안은 보조입니다. 임상 자료로 쓰기 전에 각 사진의 방향과 크롭을 직접 확인해 주세요.</p></section>
    <section aria-labelledby="usage-comparison-title" className="help-surface__section"><h3 id="usage-comparison-title">치료 전후 비교</h3><p>같은 사람·같은 각도·표정의 사진 한 쌍을 넣고 나란히, 슬라이더, 전후 전환으로 살펴봅니다. 대응점을 직접 조정할 수 있으며 얼굴을 늘이거나 휘지 않습니다.</p><p className="usage-guide__note">비교 결과는 PNG·PDF·PPTX·독립 HTML로 저장할 수 있습니다. 시술 효과 판정이나 진단이 아닙니다.</p></section>
    <section aria-labelledby="usage-privacy-title" className="help-surface__section"><h3 id="usage-privacy-title">로컬 처리</h3><p>선택한 사진과 편집 결과를 서버로 보내는 기능은 없습니다.</p><ul>{NEVER_SENT.map((item) => <li key={item}>{item}</li>)}</ul><p className="usage-guide__note">눈 가림은 선택 기능이며 익명성을 보장하지 않습니다. 내려받은 파일에는 사진이 포함됩니다.</p></section>
  </div>
}
