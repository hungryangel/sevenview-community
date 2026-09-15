# Changelog

All notable changes to SevenView are documented in this file.

## Unreleased

- 자동 정렬 완료 뒤 결과와 내보내기를 먼저 보여주고, 세부 조정은 필요할 때 여는 결과 중심
  검토 흐름으로 바꿨습니다.
- Community에 탭 메모리에서만 동작하는 단일 사진 쌍 전후 비교를 추가했습니다. 이 기능은
  촬영 조건을 같은 4:5 프레임에서 확인하며 픽셀 정합, 시술 효과 판정 또는 진단을 하지 않습니다.
- 영구 저장, 다중 시점·다중 뷰, 브랜딩, 템플릿과 외부 연동은 별도 유료/private 범위로
  유지합니다.

## v0.1.0 — 2026-08-31

Initial local-first browser baseline.

- Seven-image input, local browser decoding, landmark-assisted view proposal, and non-destructive crop adjustments.
- 4+3 PNG contact-sheet export.
- No account, upload, telemetry, or persistent workspace storage.
