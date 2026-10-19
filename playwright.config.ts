import { defineConfig, devices } from '@playwright/test'

const port = 4173
const isCI = Boolean(process.env.CI)
// Lets local runs use an installed browser, e.g. PLAYWRIGHT_CHANNEL=chrome.
const channel = process.env.PLAYWRIGHT_CHANNEL

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        channel,
      },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel },
    },
  ],
  webServer: {
    // Tests run against the production build served by Express in Demo mode.
    command: 'pnpm build:client && pnpm build:server && pnpm start',
    url: `http://localhost:${port}/api/health`,
    env: { NEWS_MODE: 'demo', PORT: String(port) },
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
