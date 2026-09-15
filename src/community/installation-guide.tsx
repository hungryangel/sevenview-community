import { ActionLink, SectionIntro } from "./landing-primitives"

export function InstallationGuide({ repositoryUrl }: { readonly repositoryUrl: string | null }) {
  return (
    <section className="sv-section sv-container" id="install">
      <SectionIntro number="03 / GET STARTED" title="설치 없이 시작하거나, 직접 설치하세요." />
      <div className="sv-install-grid">
        <article>
          <p className="sv-eyebrow">별도 개발 환경 없이</p>
          <h3>브라우저에서 사용</h3>
          <p>
            앱을 열고 사진을 선택하면 됩니다. 회원가입이나 초대 코드는 필요하지 않습니다. 처음
            실행할 때 분석 모델을 불러오므로 잠시 기다려 주세요.
          </p>
          <p>
            데스크톱 Chrome 또는 Edge의 최신 버전을 권장합니다. 작업 후에는 결과물을 내려받아
            보관하세요.
          </p>
          <ActionLink href="/app">앱 열기</ActionLink>
        </article>
        <article>
          <p className="sv-eyebrow">개발자·기관 운영 담당자</p>
          <h3>내 컴퓨터에 설치</h3>
          <p>
            Git, Node.js 24 이상, pnpm 11.19.0을 준비하세요. 터미널에서 아래 명령을 차례로
            실행합니다.
          </p>
          <pre>
            <code>{`git clone https://github.com/hungryangel/sevenview-community.git
cd sevenview-community
npm install -g pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev`}</code>
          </pre>
          <p>
            터미널에 표시된 주소를 여세요. 기본 주소는 <code>http://localhost:5173</code>이며, 앱은{" "}
            <code>/app</code>에서 실행됩니다.
          </p>
          {repositoryUrl === null ? null : (
            <ActionLink href={`${repositoryUrl}/blob/main/docs/INSTALLATION.md`} variant="text">
              상세 설치 안내
            </ActionLink>
          )}
        </article>
      </div>
    </section>
  )
}
