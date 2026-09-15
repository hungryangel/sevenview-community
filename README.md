# SevenView Community

SevenView Community는 일곱 방향 임상 사진을 브라우저에서 분류·정렬·크롭·검토하고, 치료 전후 사진을 시각적으로 비교하는 무료 로컬 우선 웹앱입니다. 가입이나 초대 코드 없이 `/app`에서 바로 사용할 수 있습니다.

## 기능

- 촬영 세트 분류, 빠진/추가 사진 안내, 수동 뷰 지정
- 크롭·위치·확대·회전 검토, 저장 상태와 다음 세트 흐름
- 나란히·슬라이더·전후 전환, 수동 대응점·확대경·눈 가림
- PNG, PDF, PPTX, 독립 HTML 저장
- 이 탭의 처리 세트·사진·저장 횟수만 로컬 저장소에 집계하며 식별자는 저장하지 않음

정량 변화 측정이나 임상 결과 판정 기능은 포함하지 않습니다.

## 로컬 실행

Node.js 24와 pnpm 11이 필요합니다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

검증:

```bash
pnpm typecheck
pnpm exec vitest run --maxWorkers=1
pnpm build
pnpm verify:community
pnpm exec playwright test --workers=1
```

## 소스 코드

공개 저장소: [hungryangel/sevenview-community](https://github.com/hungryangel/sevenview-community)

## 개인정보

선택한 사진과 분석 결과는 앱 서버로 전송되지 않습니다. 모델과 WASM은 같은 출처에서 내려받아 브라우저 안에서 실행됩니다. 호스팅 사업자는 일반적인 GET 접속 기록을 보유할 수 있습니다. 내려받은 결과에는 사진이 포함되므로 환자 동의와 기관 보관 정책에 따라 관리하세요. 자세한 내용은 [개인정보 안내](docs/PRIVACY.md)를 확인하세요.

## 라이선스와 상표

소스 코드는 [GNU Affero General Public License v3.0 only](LICENSE)로 배포됩니다. 모델·글꼴·아이콘 등 제3자 구성요소에는 각각의 라이선스가 적용됩니다. SevenView 이름과 로고 사용 범위는 [상표 정책](TRADEMARK.md)을 확인하세요.

기관별 운영·보안·연동·템플릿·추가 개발은 [커스터마이징 문의](http://pf.kakao.com/_JDbbX/chat)로 상담할 수 있습니다.
