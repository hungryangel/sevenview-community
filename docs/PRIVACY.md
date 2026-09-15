# 개인정보와 로컬 처리

SevenView Community의 `/app`은 선택한 사진을 서버로 업로드하는 API, 외부 분석 이벤트 수집기, 설문 전송 기능을 포함하지 않습니다. 얼굴·자세 모델과 WASM은 웹앱과 같은 출처에서 GET으로 내려받고, 분석·편집은 브라우저 메모리에서 실행됩니다.

호스팅 사업자는 IP 주소, User-Agent, 요청 경로 같은 일반적인 웹 접속 기록을 보유할 수 있습니다. 앱은 처리한 세트·사진·저장 횟수의 합계만 브라우저 로컬 저장소에 보관하며, 이름·파일명·사진·식별자를 넣지 않습니다. 저장소 접근이 차단되면 메모리 값으로 동작합니다.

PNG, PDF, PPTX, HTML 결과에는 사용자가 선택한 사진이 포함됩니다. 눈 가림은 식별 위험을 줄이는 보조 기능이지 완전한 익명화를 보장하지 않습니다. 결과 공유 전 환자 동의, 수신자, 보관 위치를 확인하세요.

## 소개 페이지의 선택형 Clarity

공식 소개 페이지 `https://sevenview.velnoc.com/`에서만 하단의 사용 분석을 직접 허용할 수 있습니다. 기본값은 꺼짐이며 허용 전에는 Microsoft에 연결하지 않습니다. 팝업을 띄우거나 선택을 강제하지 않습니다. 선택은 저장하지 않으며 새로고침·앱 이동 시 종료됩니다. 중지 버튼은 페이지를 새로고침합니다.

허용하면 클릭·스크롤·접속/기기 정보가 Microsoft Clarity로 전송됩니다. 페이지 내용은 마스킹하고 `consentv2`로 광고·분석 쿠키 저장을 모두 거부합니다. 쿠키 없는 분석도 정보 전송이므로 익명·무수집이라고 부르지 않습니다. Microsoft는 수신 정보를 광고 서비스 등에 사용할 수 있습니다. [Microsoft 개인정보처리방침](https://www.microsoft.com/privacy/privacystatement), [Clarity 약관](https://clarity.microsoft.com/terms)을 확인하세요.

의료 자료가 들어갈 수 있는 `/app`과 내보낸 HTML에는 Clarity를 실행하지 않습니다. 앱의 CSP는 외부 연결을 제한합니다. URL에 검색 조건이나 fragment가 있으면 소개 페이지에서도 분석을 켜지 않습니다. 자체 호스팅·미리보기 도메인에서는 실행되지 않습니다. 기존 VELNOC Clarity 프로젝트를 공유하지만 `site=sevenview-introduction`으로 구분하며, 프로젝트의 다른 사이트 설정은 변경하지 않습니다.

The hosted introduction has optional, per-visit Microsoft Clarity analytics, off by default. It never runs in the photo application or exported files. No patient photos, names, filenames or measurements are intentionally collected. Cookie storage is denied even after opt-in; network and interaction data still reach Microsoft. Self-hosted copies do not activate the official site's analytics. Contact: hello@velnoc.com.
