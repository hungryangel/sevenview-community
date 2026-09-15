import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import { normalizeBasePath } from "./build/base-path.ts"
import { buildContentSecurityPolicy } from "./build/content-security-policy.ts"

// 운영 빌드에만 CSP 메타를 심는다(개발 서버는 HMR 인라인 스크립트가 필요해 제외).
// 사진이 브라우저 밖으로 나갈 수 있는 연결 경로를 브라우저 수준에서 봉쇄한다.
function contentSecurityPolicyPlugin(): Plugin {
  return {
    name: "sevenview-content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: buildContentSecurityPolicy(),
        },
        injectTo: "head-prepend",
      },
    ],
  }
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "")
  const { VITE_BASE_PATH: configuredBasePath } = environment
  if (environment["VITE_BETA_TELEMETRY_ENDPOINT"] !== undefined) {
    throw new Error("Community builds reject beta telemetry configuration")
  }

  return {
    base: normalizeBasePath(configuredBasePath),
    plugins: [
      react(),
      contentSecurityPolicyPlugin(),
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/@mediapipe/tasks-vision/wasm/*",
            dest: "wasm",
            rename: { stripBase: true },
          },
        ],
      }),
    ],
  }
})
