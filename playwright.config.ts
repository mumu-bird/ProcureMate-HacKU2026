import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const cached =
  "/Users/pomelo/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/browser-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    launchOptions: existsSync(cached) ? { executablePath: cached } : {},
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      PROCUREMATE_DB: `/tmp/procuremate-browser-${Date.now()}.sqlite`,
      NEXT_BUILD_DIR: ".next-browser",
      PAYMENT_PROVIDER: "simulated",
      MODEL_API_KEY: "",
    },
    timeout: 60_000,
  },
});
