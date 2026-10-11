import { defineConfig } from '@playwright/test';

const PORT = 4173;

// On Windows the downloaded Chromium is blocked by App Control; use the
// installed Microsoft Edge there and Playwright's Chromium elsewhere (CI).
const channel = process.platform === 'win32' ? 'msedge' : undefined;

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel,
    launchOptions: {
      // Software WebGL so the Three.js scene renders in headless runs.
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: `node scripts/serve.mjs`,
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
