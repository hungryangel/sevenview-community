import { defineConfig, devices } from "@playwright/test"

// biome-ignore lint/complexity/useLiteralKeys: strict Node env typing requires index access.
const explicitQaUrl = process.env["SEVENVIEW_QA_BASE_URL"]

export default defineConfig({
  // 얼굴+어깨 모델을 함께 불러오는 실제 분석 시나리오를 위한 시험 예산입니다.
  timeout: 60_000,
  expect: { timeout: 20_000 },
  testDir: "./e2e",
  testIgnore: ["pages-base-path.spec.ts", "live-pages.spec.ts"],
  fullyParallel: false,
  // 8GB 장비에서 모델 기반 브라우저 검증은 한 번에 하나씩 실행합니다.
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: explicitQaUrl ?? "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  ...(explicitQaUrl === undefined
    ? {
        webServer: {
          command: "pnpm preview --host 127.0.0.1",
          reuseExistingServer: true,
          timeout: 30_000,
          url: "http://127.0.0.1:4173",
        },
      }
    : {}),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
