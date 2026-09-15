import { GearSix } from "@phosphor-icons/react"

import packageJson from "../../package.json"
import { KAKAO_CHAT_URL } from "../brand-links"

export { KAKAO_CHAT_URL } from "../brand-links"

export const APP_VERSION = packageJson.version

type AppFooterProps = {
  readonly onOpenHelp: () => void
}

export function AppFooter({ onOpenHelp }: AppFooterProps) {
  return (
    <footer className="app-footer">
      <div className="app-footer__brand">
        <img
          alt="VELNOC"
          className="app-footer__logo"
          height={14}
          src={`${import.meta.env.BASE_URL}brand/velnoc-wordmark-white.png`}
        />
        <span className="app-footer__meta">
          © {new Date().getFullYear()} VELNOC · SevenView v{APP_VERSION} · 사진은 이 브라우저 밖으로
          나가지 않습니다
        </span>
      </div>
      <div className="app-footer__actions">
        <button className="app-footer__pill" onClick={onOpenHelp} type="button">
          <GearSix aria-hidden="true" size={14} /> 설정 · 정보
        </button>
        <a
          className="app-footer__pill app-footer__pill--contact"
          href={KAKAO_CHAT_URL}
          rel="noreferrer noopener"
          target="_blank"
        >
          신고 · 기능 문의
        </a>
      </div>
    </footer>
  )
}
