# SevenView Community Design

## Foundation

Community는 기존 SevenView의 차분하고 임상적인 시각 언어를 유지합니다. `src/styles/tokens.css`의 색상·간격·타이포그래피 토큰과 기존 버튼·필드·작업영역 컴포넌트가 기준입니다. 소개 화면도 밝은 중성 배경, 짙은 청록 강조색, 명확한 계층과 넉넉한 여백을 사용합니다.

## Routes and hierarchy

- `/`: 제품 설명, 실제 작업 흐름, 로컬 처리 설명, 무료 앱과 커스터마이징 문의 CTA.
- `/app`: 기존 SevenView 작업영역. 소개 화면과 분리된 lazy chunk로 모델·앱 코드를 필요할 때만 가져옵니다.
- 알 수 없는 경로: 짧은 404와 소개 화면 링크.

## Responsive behavior

소개 화면은 3열 작업 흐름을 760px 이하에서 1열로 바꿉니다. 제목 크기는 `clamp()`로 조절하고 한국어 문장은 자연스럽게 묶습니다. 앱은 기존 375/768/1280px 동작을 유지합니다.

## Components and states

링크형 CTA는 기본·quiet 두 상태, 내비게이션은 키보드 focus-visible 상태를 제공합니다. 장식성 모션은 추가하지 않으며 `prefers-reduced-motion`을 존중합니다. 모든 이미지가 생기면 대체 텍스트와 출처가 필수입니다.

## Accessibility constraints

랜드마크·섹션·제목 순서를 지키고, 클릭 가능한 요소는 키보드로 접근 가능해야 합니다. 색만으로 상태를 전달하지 않습니다. 축소 화면에서 한 글자 고아 줄바꿈이나 가로 스크롤을 허용하지 않습니다.

## Accepted debt

공개 저장소 URL은 실제 저장소가 생성되기 전까지 `null`이며 링크를 렌더링하지 않습니다. 샘플 사진은 재배포 권리가 확정되기 전까지 release blocker입니다.
