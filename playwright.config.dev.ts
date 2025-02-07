import { defineConfig } from 'playwright/test';

// biome-ignore lint/style/noDefaultExport: https://playwright.dev/docs/test-configuration#basic-configuration
export default defineConfig({
  name: 'Klang',
  testDir: './tests',
  fullyParallel: true,
  globalTimeout: 360_000,
  globalSetup: require.resolve('./setup/global-setup'),

  maxFailures: 1,

  use: {
    headless: false,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on',
    locale: 'no-NB',
    storageState: '/tmp/state.json',
  },
});
