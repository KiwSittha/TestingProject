/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

/**
 * Terminals inside snap-installed VS Code export the snap's GIO_MODULE_DIR,
 * which makes WebKit fail every page.goto with "WebKit encountered an internal error".
 */
delete process.env.GIO_MODULE_DIR;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* E2E ตาม SRS-CART-002 (docs/e2e-srs-design.md) ชุดเดิม e2e/checkout.spec.ts ใช้กับหน้าเว็บก่อนทำ DC-2 จึงไม่รันแล้ว */
  testDir: './e2e/srs',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  /* Tests share one customer account and one database, so run them one at a time. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* API และ unit test อยู่นอก Playwright (vitest) */
  /* ทุกเทส reset ข้อมูลด้วย POST /test/reset และใช้บัญชี cus_normal, cus_prime, admin01 (รหัสผ่านจาก TEST_PASSWORD) */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev:backend',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev:frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
