import { defineConfig } from '@playwright/test'
import { loadE2eEnv } from './tests/e2e/support/env.js'

// Throws immediately if .env.e2e is missing or points at the application's database.
const { baseURL, serverEnv } = loadE2eEnv()

export default defineConfig({
  testDir: './tests/e2e',
  // Tests share one database and reset it per test, so they must run serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'en-US', // the app formats currency/dates with the browser locale
    headless: false, // project rule: e2e tests always run in a visible browser
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Test the deployable artifact: production build served by Express.
    command: 'npm run build && npm start',
    url: `${baseURL}/api/state`,
    env: serverEnv, // points the app under test at the TEST database on its own port
    reuseExistingServer: false, // never attach to a dev server that might use the real DB
    timeout: 120_000,
  },
})
