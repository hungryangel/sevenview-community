# Example and brand assets

## Existing synthetic demonstration photographs

`public/examples/01-front.png` through `07-crown-down.png` are the existing
SevenView synthetic adult seven-view examples. The project owner explicitly
requested reusing this person and these existing images for the public site and
documentation on 2026-09-15. No new portrait is used in this release.

They are AI-generated examples, not patient photographs, medical data, real
treatment outcomes or a clinical validation dataset. Their original purpose is
demonstration and local functional testing. They are included for those purposes
with SevenView; do not imply the depicted person is a patient or endorser.
This notice does not make a claim of clinical accuracy or exclusive rights in
AI-generated imagery. The code license should not be read as a trademark license.

| File | View |
| --- | --- |
| `01-front.png` | Front |
| `02-right-oblique.png` | Right oblique |
| `03-left-oblique.png` | Left oblique |
| `04-right-profile.png` | Right profile |
| `05-left-profile.png` | Left profile |
| `06-chin-up.png` | Chin up |
| `07-crown-down.png` | Crown down |

The individual portraits are 384 × 480 pixels. Left/right labels use the
project's patient-relative view convention; operators still need to review results.

## Actual application screenshots

`workspace.png` and `comparison.png` are captured from the actual Community app
using only the above examples. Comparison uses `01-front.png` on both sides to
demonstrate the slider, not to claim a treatment effect. No patient information,
private measurement features or operational data are included.

## Brand and fonts

The VELNOC wordmark is the existing unmodified project brand asset. See
[TRADEMARK.md](../TRADEMARK.md). The landing page ports the VELNOC site's palette,
typography and editorial component patterns; it does not copy its backend or
deployment configuration.

Pretendard Variable 1.3.9 is served locally from `public/fonts/` under the
[SIL Open Font License 1.1](../public/fonts/Pretendard-OFL.txt).
Upstream: https://github.com/orioncactus/pretendard/tree/v1.3.9

The binary publication guard explicitly lists these assets. New images require
provenance review and an intentional allowlist update; it does not accept an
arbitrary image directory.
