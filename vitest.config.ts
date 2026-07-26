import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        lines: 57,
        functions: 41,
        branches: 45,
        statements: 52,
        "src/domain/{ordering,quickSave,schemas,themes,urls}.ts": {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85
        },
        "src/services/wallpaper.ts": {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85
        }
      }
    }
  }
});
