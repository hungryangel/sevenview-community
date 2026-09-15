# SevenView Community · VELNOC design contract

## 2026-09-15 · Landing redesign (supersedes landing rules below)

The landing is a VELNOC product site. Port the approved VELNOC website's
editorial system (sections 13–16): white paper, pale blue sections, navy
actions, large left-aligned Korean type and real product screens. Glass is
limited to navigation/actions. `/app` retains its existing design and behavior.
All new marketing styles are scoped to `.sv-site`.

Reading order: purpose → workspace → features → usage → installation → privacy
→ paid customization. Essential content remains visible, without accordions.

Tokens in `src/community/brand.css`: paper #fff, ink #262c2e, muted #5d6d73,
line #e7edee, sage #f1f4f4, mint #def2f7, sand #faf8ed, deep #01202c,
action-hover #183e4c, focus/accent #006886. Header uses white 90%, 20px blur,
white inset highlight and navy 6% shadow; sections remain opaque.
Pretendard Variable is self-hosted under OFL, never fetched from a font CDN.
Type: hero clamp(40px,7vw,96px), heading clamp(32px,4vw,56px), subheading
24px, body 16/18px, caption 14px, eyebrow 12px. Weights 400/450/600/650.
Korean keep-all, body line-height 1.7, code overflow-x auto.
Space: 4/8/12/16/20/24/32/40/48/64/80/96/112/128px. Container 1440px;
gutters 20/32/48px. Radius 8px actions, 20px header/screens; min target
52px actions, 44px nav. Transition 180ms color/opacity/transform only.
Focus 3px with 4px offset. Header z10, skip link z20.

### Responsive and primitive states

375px one column and wrapping visible nav; 768px two-column install/privacy;
1280px 4:8 feature chapters and wide workspace. Sticky header, anchor offset
144px (including mobile two-row navigation), no bottom dock. Reduced-motion disables transitions/smooth scroll.

Reusable primitives: ProductHeader (original VELNOC logo linked to velnoc.com,
product home link, visible nav); ActionLink (solid/text, hover/pressed/focus);
SectionIntro (number/title/copy); ProductFigure (actual screenshot, intrinsic
size, alt/caption); StepList (always visible exact app labels); InstallPanel
(prerequisites, complete selectable commands, documentation links);
ContactBand (paid services clearly distinct from free Community).

### Content and evidence

Use the existing seven-view synthetic adult samples, explicitly requested by
the owner on September 15, and actual Community screenshots. No new generated
portrait is used. Document provenance in docs/ASSETS.md. No patient images,
private measurement panels, patient names or operations data. A single frontal
sample does not represent a seven-angle dataset; comparisons using the same
image are interaction demonstrations, not treatment results. English docs
must disclose Korean UI. No claims of universal recognition, clinical effect,
surgical prediction or quantitative measurement.

Verify primitive states and page at375/768/1280, keyboard/anchors/images,
installation and app links, tests/typecheck/build/release guard. Main VELNOC,
existing beta and Vercel access protection remain untouched. The earlier
repository-null and pending-asset statements below are historical only.

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
