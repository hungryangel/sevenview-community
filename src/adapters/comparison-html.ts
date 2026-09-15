import wordmark from "../../public/brand/velnoc-wordmark-white.png?inline"
import { KAKAO_CHAT_URL } from "../brand-links"
import { COMPARISON_EXPORT_LABELS, type ComparisonExportSlot } from "../domain/comparison-export"
import styles from "../styles/comparison-html.css?raw"
import tokens from "../styles/tokens.css?raw"
import { installComparisonSlider } from "./comparison-html-runtime"

export type ComparisonHtmlImage = {
  readonly slot: ComparisonExportSlot
  readonly png: Uint8Array
}

export const COMPARISON_HTML_MIME_TYPE = "text/html;charset=utf-8"

export function buildComparisonHtml(
  images: readonly [ComparisonHtmlImage, ComparisonHtmlImage],
): Uint8Array {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  const figures = images
    .map(({ slot, png }) => {
      const chunks: string[] = []
      for (let offset = 0; offset < png.length; offset += 16384) {
        chunks.push(String.fromCharCode(...png.subarray(offset, offset + 16384)))
      }
      return `<figure class="photo" data-slot="${slot}"><img src="data:image/png;base64,${btoa(chunks.join(""))}" alt="${COMPARISON_EXPORT_LABELS[slot]} · 정렬된 사진" width="752" height="940" draggable="false"><figcaption>${COMPARISON_EXPORT_LABELS[slot]}</figcaption></figure>`
    })
    .join("\n")
  const policy = `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
  return new TextEncoder().encode(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<meta name="referrer" content="no-referrer">
<title>치료 전후 비교 · SevenView by VELNOC</title>
<style>${tokens}\n${styles}</style></head><body>
<header><img class="brand-logo" src="${wordmark}" width="858" height="297" alt="VELNOC">
<div><span class="product-name">SevenView</span><span class="product-caption">임상 사진 워크스페이스</span></div></header>
<main><section class="intro"><h1>치료 전후 비교</h1><p>가운데 경계를 움직여 두 사진을 비교하세요.</p></section>
<div class="viewer"><div id="stage" class="stage">
${figures}
<div id="divider" class="divider" role="slider" tabindex="0" aria-label="사진 위 비교 경계" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" hidden>
<span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4"/></svg></span></div>
</div><div id="controls" hidden>
<div class="labels" aria-live="polite"><span id="left-label"></span><span id="right-label"></span></div>
<label class="range-label" for="position">비교 경계 위치</label><input id="position" type="range" min="0" max="100" value="50">
<div class="actions"><button id="reverse" type="button">표시 순서 바꾸기</button><button id="center" type="button">중앙으로 맞추기</button></div>
</div><noscript>슬라이더를 사용하려면 이 HTML 파일을 JavaScript가 허용된 브라우저에서 열어주세요. 위에는 정렬된 두 사진이 표시됩니다.</noscript>
</div></main>
<footer><nav class="contact-links" aria-label="문의">
<a href="${KAKAO_CHAT_URL}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="연락하기 (새 탭)">연락하기</a>
</nav><p>비교는 오프라인으로 작동합니다. 연락하기 링크는 인터넷 연결이 필요합니다.</p>
<p>같은 사람·같은 각도·표정인지 직접 확인하세요. 촬영 조건 비교용이며 시술 효과를 판정하지 않습니다.</p>
<p>사진이 포함된 파일입니다. 공유 전에 당사자의 동의와 전달 대상을 확인하세요.</p></footer>
<script nonce="${nonce}">(${installComparisonSlider.toString()})();</script></body></html>`)
}
