# 개인정보와 로컬 처리

SevenView Community의 `/app`은 선택한 사진을 서버로 업로드하는 API나 설문 전송 기능을
포함하지 않습니다. 얼굴·자세 모델과 WASM은 웹앱과 같은 출처에서 GET으로 내려받고,
분석·편집은 브라우저 메모리에서 실행됩니다.

호스팅 사업자는 IP 주소, User-Agent, 요청 경로 같은 일반적인 웹 접속 기록을 보유할 수
있습니다. 앱은 처리한 세트·사진·저장 횟수의 합계와 아래 집계 설정만 브라우저 로컬 저장소에
보관하며, 이름·파일명·사진·식별자를 넣지 않습니다. 저장소 접근이 차단되면 메모리 값으로
동작합니다.

PNG, PDF, PPTX, HTML 결과에는 사용자가 선택한 사진이 포함됩니다. 눈 가림은 식별 위험을 줄이는 보조 기능이지 완전한 익명화를 보장하지 않습니다. 결과 공유 전 환자 동의, 수신자, 보관 위치를 확인하세요.

## 공식 사이트의 기본 사용 집계

공식 사이트는 서비스 개선을 위해 `landing_visit`, `app_use`, `export_complete` 세 이벤트의
발생 횟수를 기본으로 집계합니다. 사용자는 소개 페이지와 앱 설정에서 언제든 끌 수 있습니다.
브라우저가 Global Privacy Control(GPC) 또는 Do Not Track(DNT)을 알리면 보내지 않습니다.
집계가 꺼져 있거나 수집기가 중단·할당량 초과 상태여도 사진 작업과 저장은 계속됩니다.

전송 JSON에는 고정된 `event` 값 하나만 있습니다. 사진, 이름, 파일명, 환자 식별자, 측정값,
DOM, 클릭 좌표, 원본 URL, referrer, 쿠키, 사용자·세션 ID를 넣지 않습니다. Cloudflare는 HTTPS
요청을 전달하는 과정에서 IP 주소 같은 통신 정보를 처리하지만, SevenView Worker는 이를
애플리케이션 로그나 데이터베이스에 기록하지 않습니다. Worker 관찰 로그와 invocation log도
비활성화합니다.

Cloudflare D1에는 UTC 날짜, 이벤트 이름, 합계만 저장하고 90일 창보다 오래된 날짜를
삭제합니다. 따라서 수치는 사람 수나 고유 방문자 수가 아니라 이벤트 횟수입니다.
`export_complete`는 브라우저가 다운로드를 넘긴 시점을 뜻하며 디스크 기록을 증명하지
않습니다. 집계 조회 API는 공개하지 않고 운영자가 인증된 Cloudflare CLI로만 합계를 읽습니다.
자체 호스팅 빌드는 별도 수집 주소를 설정하지 않으면 이 집계를 보내지 않습니다.

## 소개 페이지의 선택형 Clarity

공식 소개 페이지 `https://sevenview.velnoc.com/`에서만 하단의 사용 분석을 직접 허용할 수 있습니다. 기본값은 꺼짐이며 허용 전에는 Microsoft에 연결하지 않습니다. 팝업을 띄우거나 선택을 강제하지 않습니다. 선택은 저장하지 않으며 새로고침·앱 이동 시 종료됩니다. 중지 버튼은 페이지를 새로고침합니다.

허용하면 클릭·스크롤·접속/기기 정보가 Microsoft Clarity로 전송됩니다. 페이지 내용은 마스킹하고 `consentv2`로 광고·분석 쿠키 저장을 모두 거부합니다. 쿠키 없는 분석도 정보 전송이므로 익명·무수집이라고 부르지 않습니다. Microsoft는 수신 정보를 광고 서비스 등에 사용할 수 있습니다. [Microsoft 개인정보처리방침](https://www.microsoft.com/privacy/privacystatement), [Clarity 약관](https://clarity.microsoft.com/terms)을 확인하세요.

의료 자료가 들어갈 수 있는 `/app`과 내보낸 HTML에는 Clarity를 실행하지 않습니다. 앱의 CSP는 외부 연결을 제한합니다. URL에 검색 조건이나 fragment가 있으면 소개 페이지에서도 분석을 켜지 않습니다. 자체 호스팅·미리보기 도메인에서는 실행되지 않습니다. 기존 VELNOC Clarity 프로젝트를 공유하지만 `site=sevenview-introduction`으로 구분하며, 프로젝트의 다른 사이트 설정은 변경하지 않습니다.

The official site sends one of three fixed aggregate events by default, unless the user opts out or
the browser signals GPC/DNT. The payload contains only the event name; D1 retains UTC day, event and
count for 90 days. Cloudflare handles transport metadata such as IP addresses, but the Worker does
not intentionally log or store it. Separately, the introduction offers optional, per-visit Microsoft
Clarity analytics, off by default. Clarity never runs in the photo application or exported files.
Self-hosted copies activate neither service unless configured. Contact: hello@velnoc.com.
