import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production preview on its own loopback port (distinct from `npm run preview`).
 * E2E_PORT / E2E_DIST let several runs work side by side (each builds to its own folder:
 * `npx vite build --outDir .e2e-x`, then `E2E_PORT=4321 E2E_DIST=.e2e-x npx playwright test`).
 */
const PORT = Number(process.env.E2E_PORT ?? 4317);
const DIST = process.env.E2E_DIST ?? 'dist';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: DIST === 'dist' ? 'test-results' : `test-results-${PORT}`,
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
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort --outDir ${DIST}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
