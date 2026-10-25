import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.mjs",
  timeout: 90000,
  workers: 1,
  use: {
    viewport: { width: 1512, height: 982 },
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --port 5175",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
