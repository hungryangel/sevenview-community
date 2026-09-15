import { useUsagePreference } from "./use-usage-preference"

export function UsagePreference() {
  const [enabled, setEnabled] = useUsagePreference()
  return (
    <section className="usage-preference" id="usage-privacy">
      <label>
        <input
          checked={enabled}
          onChange={(event) => setEnabled(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>익명 사용 집계 허용</span>
      </label>
      <p>
        방문·사진 작업 시작·다운로드 요청 횟수만 집계합니다. 사진, 파일명, 환자 정보, 측정값, 페이지
        주소는 보내지 않습니다. DNT 또는 GPC가 켜져 있으면 이 설정과 관계없이 전송하지 않습니다.
      </p>
    </section>
  )
}
