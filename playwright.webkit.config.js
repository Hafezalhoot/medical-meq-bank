import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /webkit-smoke\.spec\.js/,
  timeout: 60_000,
  expect: {timeout: 10_000},
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', {outputFolder: 'playwright-report-webkit', open: 'never'}]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        browserName: 'webkit'
      }
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit'
      }
    }
  ],
  webServer: {
    command: 'python3 -m http.server 4174 --directory dist --bind 127.0.0.1',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 15_000
  }
});
