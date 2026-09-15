import { UsagePreference } from "../usage/usage-preference"
import { AnalyticsPreference } from "./analytics-preference"
import "./brand-footer.css"

export function BrandFooter({ repositoryUrl }: { readonly repositoryUrl: string | null }) {
  return (
    <footer className="sv-brand-footer">
      <div className="sv-container sv-footer-top">
        <a href="https://velnoc.com/" aria-label="VELNOC 홈페이지">
          <img src="/brand/velnoc-wordmark.png" width="600" height="208" alt="VELNOC" />
        </a>
        <p>
          건강한 삶의 가능성을,
          <br />
          기술로 넓힙니다.
        </p>
        <div>
          <a href="mailto:hello@velnoc.com">hello@velnoc.com</a>
          <span>Health &amp; wellness technology</span>
        </div>
      </div>
      <nav className="sv-container sv-footer-bottom" aria-label="VELNOC 하단 메뉴">
        <small>© 2026 VELNOC</small>
        <a href="https://velnoc.com/partners">Intelligence 자세히 보기</a>
        <a href="https://velnoc.com/#services">서비스와 도구</a>
        <a href="https://velnoc.com/research">연구 및 기여</a>
        <a href="https://velnoc.com/en" lang="en" aria-label="VELNOC English">
          EN
        </a>
      </nav>
      <div className="sv-container sv-footer-resources">
        {repositoryUrl === null ? null : (
          <>
            <a href={repositoryUrl}>GitHub · English</a>
            <a href={`${repositoryUrl}/blob/main/LICENSE`}>AGPL-3.0-only</a>
            <a href={`${repositoryUrl}/blob/main/docs/PRIVACY.md`}>개인정보 처리 안내</a>
          </>
        )}
        <UsagePreference />
        <AnalyticsPreference />
      </div>
    </footer>
  )
}
