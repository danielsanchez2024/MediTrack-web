// @ts-check
const { defineConfig } = require('@playwright/test');

// Runs every test once per time zone: the API speaks instants with offsets (see the
// backend's ApiDateTimeConfig) and the web has to show the right local time in all of them.
// America/Bogota is the server's own zone; Madrid and UTC are the ones that used to break.
const TIME_ZONES = ['America/Bogota', 'Europe/Madrid', 'UTC'];

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Every test creates its own accounts, so they can run side by side.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // The whole stack behind nginx, as started by `docker compose up` in the repo root.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost',
    locale: 'es-CO',
    // The locally installed Google Chrome by default (no browser download needed); set
    // E2E_BROWSER=chromium to use Playwright's own after `npx playwright install chromium`.
    ...(process.env.E2E_BROWSER === 'chromium' ? {} : { channel: 'chrome' }),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: TIME_ZONES.map((timezoneId) => ({ name: timezoneId, use: { timezoneId } }))
});
