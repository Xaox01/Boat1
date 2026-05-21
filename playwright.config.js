import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    // Screenshoty trafiają do tests/screenshots/
    screenshot: 'only-on-failure',
  },
  snapshotDir: './tests/snapshots',
  expect: {
    toHaveScreenshot: {
      // Dopuszczalna różnica pikselowa między baseline a aktualnym screenshotem
      maxDiffPixelRatio: 0.04,
    },
  },
  // Serwer dev musi być uruchomiony ręcznie (npm run dev) przed testami
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
