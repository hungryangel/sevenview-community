type CommunityLandingProps = { readonly repositoryUrl: string | null }

const CONTACT_URL = "http://pf.kakao.com/_JDbbX/chat"

export function CommunityLanding({ repositoryUrl }: CommunityLandingProps) {
  return <div className="community-landing">
    <header className="community-nav"><a className="community-brand" href="/" aria-label="SevenView Community 홈">SevenView <span>Community</span></a><nav aria-label="주요 메뉴"><a href="#workflow">사용 방법</a>{repositoryUrl === null ? null : <a href={repositoryUrl}>소스 코드</a>}<a className="community-nav-cta" href="/app">무료 앱</a></nav></header>
    <main>
      <section className="community-hero"><p className="community-eyebrow">LOCAL-FIRST CLINICAL PHOTO WORKSPACE</p><h1>일곱 장의 임상 사진을 한결같은 기록으로.</h1><p className="community-lead">촬영 세트를 분류하고, 구도와 수평을 맞추고, 치료 전후를 시각적으로 비교하세요. 사진 처리는 브라우저 안에서 이루어집니다.</p><div className="community-actions"><a className="community-button" href="/app">무료 앱 시작</a><a className="community-button community-button--quiet" href="#workflow">사용 방법 보기</a></div><p className="community-assurance">가입·초대 코드 없음 · 사진 업로드 없음 · AGPL-3.0-only</p></section>
      <section className="community-section" id="workflow"><p className="community-eyebrow">WORKFLOW</p><h2>촬영부터 저장까지, 한 흐름으로</h2><div className="community-grid"><article><span>01</span><h3>사진 불러오기</h3><p>여러 장을 한 번에 선택하면 촬영 방향에 따라 분류하고 빠진 구도를 알려줍니다.</p></article><article><span>02</span><h3>구도 검토하기</h3><p>크롭, 위치, 확대, 수평을 직접 확인하고 필요하면 수동으로 바로잡습니다.</p></article><article><span>03</span><h3>비교하고 저장하기</h3><p>나란히·슬라이더·전후 전환으로 살펴보고 PNG, PDF, PPTX 또는 독립 HTML로 저장합니다.</p></article></div></section>
      <section className="community-section community-features"><div><p className="community-eyebrow">PRIVATE BY DESIGN</p><h2>사진은 작업 중에도<br />기기 밖으로 나가지 않습니다.</h2></div><div className="community-copy"><p>얼굴과 자세 분석 모델은 앱과 함께 내려받아 브라우저에서 실행됩니다. 웹 호스팅 사업자는 일반적인 페이지 접속 기록을 보유할 수 있지만, 선택한 사진을 서버로 전송하는 기능은 없습니다.</p><p>저장한 결과 파일에는 선택한 사진이 포함됩니다. 환자 동의와 기관의 보관 정책에 따라 안전하게 관리해 주세요.</p></div></section>
      <section className="community-contact"><p className="community-eyebrow">FOR YOUR CLINIC</p><h2>기관의 실제 업무에 맞춘 도구가 필요하신가요?</h2><p>운영 환경, 보안 정책, 시스템 연동, 출력 템플릿과 추가 기능을 함께 설계합니다.</p><a className="community-button" href={CONTACT_URL}>커스터마이징 문의</a></section>
    </main><footer className="community-footer"><span>SevenView Community</span><span>사진 표준화와 시각적 비교를 위한 무료 웹 도구</span></footer>
  </div>
}
