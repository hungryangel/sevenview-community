import { InstallationGuide } from "./installation-guide"
import { ActionLink, ProductFigure, SectionIntro } from "./landing-primitives"
import { UsageGuide } from "./usage-guide"
import "./brand.css"
import "./landing-header-hero.css"
import "./landing.css"

type CommunityLandingProps = { readonly repositoryUrl: string | null }
const CONTACT_URL = "http://pf.kakao.com/_JDbbX/chat"

export function CommunityLanding({ repositoryUrl }: CommunityLandingProps) {
  return (
    <div className="sv-site">
      <a className="sv-skip" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="sv-header">
        <div className="sv-brand">
          <a href="https://velnoc.com/" aria-label="VELNOC 홈페이지">
            <img src="/brand/velnoc-wordmark.png" width="600" height="208" alt="" />
          </a>
          <a href="/" className="sv-product-name">
            SevenView <span>Community</span>
          </a>
        </div>
        <nav aria-label="주요 메뉴">
          <a href="#features">기능</a>
          <a href="#workflow">사용 방법</a>
          <a href="#install">설치 안내</a>
          <a href="/app" className="sv-nav-app">
            앱 열기
          </a>
        </nav>
      </header>
      <main id="main">
        <section className="sv-hero">
          <div className="sv-container">
            <p className="sv-eyebrow">VELNOC / SEVENVIEW COMMUNITY</p>
            <h1>
              사진을 정리하는 시간,
              <br />
              <strong>환자를 이해하는 시간으로.</strong>
            </h1>
            <div className="sv-hero-bottom">
              <div>
                <p className="sv-lead">
                  촬영 사진의 구도를 맞추고, 전후를 비교하고, 설명에 쓸 자료로 저장하세요. 코딩 없이
                  사용하는 VELNOC의 오픈소스 사진 도구입니다.
                </p>
                <div className="sv-actions">
                  <ActionLink href="/app">무료 앱 시작</ActionLink>
                  <ActionLink href="#workflow" variant="text">
                    사용 방법 보기
                  </ActionLink>
                </div>
              </div>
              <p className="sv-note">
                가입·초대 코드 없이
                <br />
                사진 처리는 내 브라우저에서
                <br />
                소스 코드는 AGPL-3.0-only
              </p>
            </div>
            <ProductFigure
              src="/examples/workspace.png"
              width={1440}
              height={1000}
              alt="기존 합성 예시 인물의 일곱 방향 사진을 정렬한 SevenView Community 실제 작업 화면"
              caption="7뷰 실제 작업 화면 · 기존 합성 예시 인물 사용"
              eager
            />
          </div>
        </section>
        <section className="sv-section sv-container" id="features">
          <SectionIntro number="01 / FEATURES" title="한 번 정리하고, 여러 방식으로 설명하세요." />
          <div className="sv-chapter">
            <div>
              <h3>
                흩어진 촬영 사진을
                <br />한 세트로.
              </h3>
              <p>
                촬영 방향을 자동으로 제안하고, 빠진 사진과 검토가 필요한 사진을 한곳에서 확인합니다.
                제안이 맞지 않으면 직접 구도와 수평을 수정하세요.
              </p>
              <p className="sv-caption">
                7뷰 기반의 얼굴 사진 도구입니다. 눈 주변 확대 사진·구강 사진 등은 자동 인식이 어려울
                수 있습니다.
              </p>
            </div>
            <div className="sv-photo-strip">
              <img
                src="/examples/01-front.png"
                width="384"
                height="480"
                alt="정면 합성 예시 사진"
                loading="lazy"
              />
              <img
                src="/examples/02-right-oblique.png"
                width="384"
                height="480"
                alt="45도 합성 예시 사진"
                loading="lazy"
              />
              <img
                src="/examples/04-right-profile.png"
                width="384"
                height="480"
                alt="측면 합성 예시 사진"
                loading="lazy"
              />
            </div>
          </div>
          <div className="sv-chapter">
            <div>
              <h3>
                비교는 직관적으로.
                <br />
                설명은 어디에서나.
              </h3>
              <p>
                나란히 보기, 경계를 움직이는 슬라이더, 전후 전환을 지원합니다. 설명용 HTML은 사진을
                포함한 한 파일로 저장되어 브라우저에서 다시 열 수 있습니다.
              </p>
              <p className="sv-caption">
                아래 화면은 동일한 합성 사진으로 조작을 보여주는 예시입니다. 실제 환자나 시술 결과가
                아닙니다.
              </p>
            </div>
            <ProductFigure
              src="/examples/comparison.png"
              width={1440}
              height={1000}
              alt="합성 사진으로 슬라이더 비교 기능을 보여주는 실제 Community 화면"
              caption="슬라이더 비교 예시 · 동일 사진 사용, 치료 효과를 나타내지 않음"
            />
          </div>
          <div className="sv-output-row">
            <span>
              7뷰 결과 <strong>PNG · PDF · PPTX · ZIP</strong>
            </span>
            <span>
              전후 비교 <strong>PNG · 독립 HTML</strong>
            </span>
            <span>
              공개 범위 <strong>정렬 · 크롭 · 시각적 비교</strong>
            </span>
          </div>
        </section>
        <UsageGuide repositoryUrl={repositoryUrl} />
        <InstallationGuide repositoryUrl={repositoryUrl} />
        <section className="sv-band sv-band--sand" id="privacy">
          <div className="sv-container sv-two-column">
            <SectionIntro number="04 / LOCAL FIRST" title="사진은 기기 안에서 처리합니다." />
            <div className="sv-copy">
              <p>
                선택한 사진을 서버에 업로드하는 기능은 없습니다. 분석 모델과 서체도 앱과 같은
                서버에서 받아 브라우저 안에서 실행합니다. 호스팅 사업자는 페이지 접속 기록을 보유할
                수 있습니다.
              </p>
              <p>
                다운로드한 파일에는 사진이 포함됩니다. 눈 모자이크를 적용하더라도 완전한 익명화를
                보장하지 않으므로, 공유 전에 결과와 동의 범위를 확인하세요.
              </p>
              <p>
                Community에는 면적·길이·변화율 측정이 포함되지 않습니다. 자동 정렬은 보조 기능이며,
                진단이나 시술 결과 예측 도구가 아닙니다.
              </p>
              {repositoryUrl === null ? null : (
                <a className="sv-text-link" href={`${repositoryUrl}/blob/main/docs/PRIVACY.md`}>
                  개인정보 처리 구조 자세히 보기
                </a>
              )}
            </div>
          </div>
        </section>
        <section className="sv-section sv-container sv-two-column" id="custom">
          <SectionIntro number="05 / WORK WITH VELNOC" title="우리 병원의 흐름에 맞춰야 한다면." />
          <div className="sv-copy">
            <p>
              Community는 무료로 사용하고 직접 설치할 수 있습니다. 별도의 운영 지원과 병원 맞춤
              개발은 유료로 상담합니다.
            </p>
            <ul className="sv-service-list">
              <li>병원 내부 설치·운영 및 보안 환경 검토</li>
              <li>기존 시스템 연동 가능성 검토</li>
              <li>촬영 세트·출력 템플릿·추가 기능 개발</li>
            </ul>
            <ActionLink href={CONTACT_URL}>유료 커스터마이징 문의</ActionLink>
            <p className="sv-caption">
              필요한 업무와 현재 환경을 알려주세요. 범위와 비용은 협의 후 정합니다.
            </p>
          </div>
        </section>
      </main>
      <footer className="sv-footer sv-container">
        <div>
          <strong>SevenView Community</strong>
          <p>의료 현장의 반복 작업을 줄이는 VELNOC의 오픈소스 도구.</p>
        </div>
        <nav aria-label="하단 메뉴">
          <a href="https://velnoc.com/">VELNOC</a>
          {repositoryUrl === null ? null : (
            <>
              <a href={repositoryUrl}>GitHub · English</a>
              <a href={`${repositoryUrl}/blob/main/LICENSE`}>AGPL-3.0-only</a>
            </>
          )}
        </nav>
      </footer>
    </div>
  )
}
