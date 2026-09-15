// 사진이 브라우저 밖으로 나갈 수 있는 연결 경로를 CSP로 직접 막습니다.
// 모델과 WASM은 모두 같은 출처의 정적 자산입니다.
//  - script-src 'wasm-unsafe-eval': MediaPipe WASM 인스턴스화에 필요(eval은 불허)
//  - style-src 'unsafe-inline': React 인라인 style 속성(가이드 선 위치 등)
//  - img-src blob:: 입력 사진 미리보기 object URL
export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}
