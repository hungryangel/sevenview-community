# Architecture

SevenView는 사진 바이트가 UI 경계를 넘어 서버로 흐르지 않도록 브라우저 내부 파이프라인을
작은 경계로 나눕니다.

## 레이어

| 레이어 | 위치 | 책임 |
| --- | --- | --- |
| Domain | `src/domain` | 좌표, 뷰 배정, 분석 여정, 7뷰/비교 렌더 모델, 접촉 시트 레이아웃 |
| Adapters | `src/adapters` | MediaPipe, 브라우저 이미지 디코드, Canvas 렌더, 로컬 파일 생성 |
| Services | `src/services` | 취소 가능한 순차 배치 분석과 실제 진행 이벤트 |
| UI primitives | `src/ui` | 접근 가능한 상태·입력 컴포넌트 |
| Product | `src/product` | 작업 상태와 화면 조합 |

Domain 함수는 DOM, React, MediaPipe를 알지 못합니다. 같은 출처의 로컬 모델 결과는 landmark
adapter에서 `FaceAnchors`로 분석하면서 검증된 원본 점들도 optional `landmarkGeometry`에
보존합니다. 현재 모델은 478개 점을 반환합니다. 기존 `registrationAnchors`와 모두 adapter →
batch item → workspace까지 정규화 좌표로 전달됩니다. 기준점이 없거나 유효하지 않으면 비교는
추정점을 만들지 않고 사용자 확인을 요구합니다. 귀·모발 경계 검출은 구현하지 않습니다.

## 데이터 흐름

1. 파일 경계가 개수, MIME, 크기를 검증합니다.
2. 브라우저가 EXIF 방향을 반영해 `ImageBitmap`으로 디코드합니다.
3. MediaPipe가 각 이미지에서 한 얼굴의 landmark를 찾습니다.
4. Domain이 yaw, pitch, roll, bounds, crop anchor와 `registrationAnchors`를 계산합니다.
5. Service는 현재 generation에 속한 실제 item/stage 이벤트만 workspace에 전달합니다.
6. 7뷰는 pose를 canonical 순서에 배정하고 하나의 `WorkspaceRenderModel`에서 4:5 화면,
   개별 PNG, 접촉 시트, PDF/PPTX용 동일 크롭 지시를 만듭니다.
7. 전후 비교는 실제 상부 얼굴 5~7개 후보점의 합의 기반 다점 정합 또는 사용자가 확정한
   두 대응점으로 per-image uniform scale, rotation,
   translation만 계산하고 하나의 comparison render model을 모든 보기 모드와 PNG/PDF/PPTX/HTML에 씁니다.
   HTML은 개별 PNG와 같은 최종 크롭 바이트, 기본 VELNOC 로고, 자체 포함 슬라이더 런타임을
   직렬화합니다. 원본·랜드마크·세션명은 본문에 넣지 않으며 외부 리소스나 서버 없이 열립니다.
   촬영 방향은 두 pose에서 추정하고, 불일치는 사용자 확인으로 보류합니다. 정면은 눈 수평,
   사선·측면은 시술 전 0° 기준에 대한 상대 정렬입니다. 출력 순서는 사진의 전/후 의미와 분리됩니다.
   자동 합의가 불안정하면 수동 확인을 요청합니다. `face_not_detected`에 한해 디코드 결과를
   메모리에 보존하고, 명시적 `manual` 전환은 pose를 만들지 않습니다. 한쪽만 실패해도 방향과
   양쪽 대응점이 모두 확인되기 전에는 내보내기를 막습니다. 교체·재시도·종료 때 자원을 해제합니다.
8. Canvas adapter는 같은 지시와 `#f4f4f2` output background로 로컬 결과를 렌더합니다.

분석 여정 모델에는 파일명을 담지 않습니다. 복구와 현재 세트 검토에 필요한 `File`·파일명은
현재 탭 메모리에만 유지하며 로그·텔레메트리·영구 저장소로 보내지 않습니다. 완료되지 않은
배치는 내보내지 않습니다. 7뷰와 전후 비교 workspace는 셸에서 각각 한 번 mount되고, 비활성
workspace는 `hidden`·`inert` 상태로 자원을 유지합니다.
탭 전환은 자원 해제가 아니며 새로고침·탭 종료 뒤 상태 복원은 제공하지 않습니다.

## 성능과 수명

8GB 장비를 기준으로 사진을 병렬 분석하지 않고 한 장씩 처리합니다. 보이는 문서에서는
`requestAnimationFrame`, 숨은 문서에서는 `MessageChannel`로 제어권을 돌려 분석이 정지하지
않게 합니다. 각 실행은 generation과 `AbortSignal`로 식별하며 decode·analyze·yield 전후에
취소를 확인합니다. 오래된 실행은 이미지 URL/bitmap/analyzer를 해제하지만 화면, 포커스,
live region, 완료·내보내기 상태를 갱신하지 않습니다.

비활성 탭은 global drop, shortcut, autofocus, announcement, presentation replay를 실행하지
않습니다. 교체·reset·app unmount는 각 소유 자원을 정확히 한 번 해제합니다. 전환 표현은
readiness와 분리되어 있고 reduced motion에서는 기록된 현재 단계와 완성 결과를 즉시 표시합니다.

## 신뢰 경계

- 신뢰: pinned application code, bundled WASM, browser canvas implementation
- 외부: hosting origin, browser extensions, downloaded PNG destination
- 금지: 환자 사진을 테스트 fixture, 로그, 텔레메트리, 외부 URL로 전달. 화면 표시용 로컬
  `blob:` URL은 현재 탭 안에서만 만들고 자원 수명 종료 시 해제
