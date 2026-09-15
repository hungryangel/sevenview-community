# User guide / 사용 방법

[Introduction](../README.md) · [Installation](INSTALLATION.md)

The current UI uses Korean. This guide maps its main labels to English.
Use [the existing synthetic sample set](../public/examples) for your first run.

## Organize a set / 촬영 세트 정리

1. Open `/app` → **사진 파일 선택** (choose photo files).
2. Choose the `01-` through `07-` sample PNG files. They cover front, both
   obliques, both profiles, chin-up and crown-down. Do not upload the screenshots.
3. Select **AI 자동 정렬** (AI alignment). Wait for model initialization.
4. Check every assignment. Left/right refers to the subject; confirm rather than
   judging solely by the side of the screen. Missing/additional photos need review.
5. Select a photo to inspect crop, translation, scale and rotation. Save/review
   before moving to another set. Automatic outputs may need correction.

![Actual seven-view review](../public/examples/workspace.png)

Seven photos are not mandatory, but this is a seven-view facial workspace—not a
general-purpose four-shot eye consultation or intraoral classification system.
Partial face photographs, eye occlusion and profiles can require manual work.

## Compare two photos / 전후 비교

1. Open **치료 전후 비교** (treatment before/after comparison).
2. Select **시술 전 사진 파일 선택** and **시술 후 사진 파일 선택**.
3. Press **두 사진 정렬** (align both photos).
4. Confirm corresponding anatomy and framing. If automatic alignment fails,
   use the paired reference editor: mark the same anatomical location in each
   image, not the same screen coordinate. The magnifier assists placement.
5. Choose **나란히** (side by side), **슬라이더** (slider) or **전후 전환** (toggle).
   Drag the boundary; keyboard users can focus the slider and use arrow keys.

![Actual slider using the same synthetic image on each side](../public/examples/comparison.png)

This example demonstrates interaction only. It does not depict treatment.
Different pose, expression, camera distance or lighting can change appearance;
the app does not establish clinical efficacy or physical area/volume change.

## Export / 결과물 저장

| Task | Output |
| --- | --- |
| Seven-view set | Contact sheet PNG, PDF, PPTX; individual-photo ZIP |
| Two-photo comparison | PNG; interactive standalone HTML |

For the interactive file: **비교 이미지 저장** (comparison export) → select
**설명용 HTML** → **비교 파일 저장** (save). Open the downloaded `.html` file in a
browser. Its slider works without the app server because images are embedded.
Keep the file intact; renaming it does not remove its photo contents.

내려받은 파일을 직접 열어 사진·크롭·방향·가림 상태를 확인한 뒤 공유하세요.
눈 모자이크는 완전한 익명화를 보장하지 않습니다. 환자 사진이 들어간 HTML·이미지·문서는
기관의 동의와 보관 정책에 따라 취급해야 합니다.

## What is not included

No quantitative length/area/percentage-change reports, diagnostic judgment,
predicted surgical outcome, cloud patient database or automatic ERP integration.
[Paid customization](http://pf.kakao.com/_JDbbX/chat) is a separate discussion,
not a prerequisite for using Community.
