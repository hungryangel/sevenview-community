import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "e2e/**", "telemetry-server/**"],
    fileParallelism: false,
    maxWorkers: 1,
  },
})
