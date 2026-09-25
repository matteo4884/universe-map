import { defineConfig } from "@playwright/test";

// Smoke tests against the production build (vite preview): catches what unit
// tests can't, like a bundle that fails at runtime
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:4173",
    // Locally reuse the installed Chrome; CI installs Playwright's Chromium
    channel: process.env.CI ? undefined : "chrome",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
