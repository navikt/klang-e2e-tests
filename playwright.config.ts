import { defineConfig } from 'playwright/test';

export default defineConfig({
  name: 'Klang',
  testDir: './tests',
  fullyParallel: true,
  globalTimeout: 360_000,
  globalSetup: require.resolve('./setup/global-setup'),

  outputDir: '/tmp/test-results',
  reporter: [['list'], ['./reporters/slack-reporter.ts'], ['./reporters/status.ts']],
  retries: 1,

  use: {
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
    locale: 'no-NB',
    storageState: '/tmp/state.json',
  },
});
