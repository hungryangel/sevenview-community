import { useState } from "react"
import { enableLandingAnalytics } from "./landing-analytics"

export function AnalyticsPreference() {
  const [status, setStatus] = useState<"off" | "on" | "unavailable">("off")
  return (
    <details className="sv-analytics">
      <summary>소개 페이지 사용 분석 · {status === "on" ? "이번 방문 허용" : "꺼짐"}</summary>
      <p>
        선택하면 이번 소개 페이지 방문의 클릭·스크롤·기기 및 접속 정보가 Microsoft Clarity로
        전송됩니다. Microsoft가 정보를 광고 서비스에 활용할 수 있습니다. 쿠키 저장은 거부하며, 사진
        편집 앱과 다운로드 파일에는 적용하지 않습니다. 선택하지 않아도 모든 기능을 사용할 수
        있습니다.
      </p>
      <p>
        <a href="https://www.microsoft.com/privacy/privacystatement">Microsoft 개인정보 안내</a>
      </p>
      <button
        type="button"
        onClick={() => {
          if (status === "on") {
            window.location.replace("/")
            return
          }
          setStatus(enableLandingAnalytics() ? "on" : "unavailable")
        }}
      >
        {status === "on" ? "분석 중지하고 새로고침" : "이번 소개 페이지 분석 허용"}
      </button>
      <p role="status">
        {status === "unavailable"
          ? "공식 소개 페이지의 기본 주소에서만 사용할 수 있습니다. 주소의 # 또는 검색 조건을 제거해 주세요."
          : status === "on"
            ? "분석 코드가 활성화되었습니다. 차단 도구가 있으면 전송되지 않을 수 있습니다."
            : "허용하기 전에는 Clarity에 연결하지 않습니다."}
      </p>
    </details>
  )
}
