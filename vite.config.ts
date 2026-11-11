/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** App version shown on the Admin page (from package.json, read at build time). */
const APP_VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

/**
 * Optional anonymous usage counter (server/pings). Set VITE_PINGS_URL at build time
 * to enable the opt-in switch; when unset, the app makes no outside connections.
 */
const PINGS_ORIGIN = process.env.VITE_PINGS_URL ? new URL(process.env.VITE_PINGS_URL).origin : '';

/** Strict CSP for production builds: no external scripts or fonts; connections only to this site (and the counter, if configured). */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  `connect-src 'self'${PINGS_ORIGIN ? ' ' + PINGS_ORIGIN : ''}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`;

function productionCsp(): Plugin {
  return {
    name: 'adaptfit-production-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  // Relative base: the same build works at a domain root (https://example.com/)
  // and under a sub-path (GitHub Pages: https://<user>.github.io/<repo>/).
  // Safe because routing is hash-based, so index.html is always served from the base folder.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    react(),
    productionCsp(),
    VitePWA({
      // Updates wait for the user to choose "Refresh" — never auto-reload mid-workout.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'sw-timer.js'],
      manifest: {
        name: 'AdaptFit',
        short_name: 'AdaptFit',
        id: './',
        description: 'Train simply. Progress intelligently. Your workout reads like a note; update only what changed and get honest progress analysis. Works offline; data stays on this device.',
        theme_color: '#f6f2ea',
        background_color: '#f6f2ea',
        display: 'standalone',
        categories: ['health', 'fitness', 'productivity'],
        orientation: 'portrait',
        start_url: './',
        // Android: AdaptFit appears in the Share menu once installed; shared text opens Import (see sharedText.ts).
        share_target: { action: './', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell and static assets only. Personal records live in IndexedDB, never in caches.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
        // Tapping a timer notification brings AdaptFit back to the front.
        importScripts: ['sw-timer.js'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}', 'tests/server/**/*.test.ts'],
    restoreMocks: true,
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/main.tsx', 'src/**/*.css'], reporter: ['text-summary', 'html'] },
  },
});
