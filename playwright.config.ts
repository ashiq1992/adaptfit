import { defineConfig, devices } from '@playwright/test';

/** E2E runs against the production preview on its own loopback port (distinct from `npm run preview`). */
const PORT = 4317;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
    // Synthetic seed data uses Singapore time; keep day boundaries consistent.
    timezoneId: 'Asia/Singapore',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    // `npm run test:e2e` builds first; this serves the fresh dist/ on loopback only.
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
