import { slackReporter, statusReporter } from '@navikt/klage-e2e-reporters';
import { defineConfig } from 'playwright/test';

export default defineConfig({
  name: 'Klang',
  testDir: './tests',
  fullyParallel: true,
  globalTimeout: 360_000,
  globalSetup: require.resolve('./setup/global-setup'),

  outputDir: '/tmp/test-results',
  reporter: [
    ['list'],
    slackReporter({ botName: 'Klang E2E', iconUrl: 'navikt/klang/main/frontend/assets/logo192.png' }),
    statusReporter({ name: 'Klang E2E' }),
  ],
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
