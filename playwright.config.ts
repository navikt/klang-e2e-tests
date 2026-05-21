import { slackReporter, statusReporter } from '@navikt/klage-e2e-reporters';
import { defineConfig } from '@playwright/test';

const isInNais = process.env.CONFIG === 'nais';

export const storageState = isInNais ? '/tmp/state.json' : './state.json';

const baseConfig = defineConfig({
  name: 'Klang',
  testDir: './tests',
  testMatch: '**/*.test.ts',
  fullyParallel: true,
  globalTimeout: 360_000,
  globalSetup: './setup/global-setup.ts',

  use: {
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    locale: 'no-NB',
    storageState,
  },
});

const local = defineConfig({
  ...baseConfig,

  maxFailures: 1,
  outputDir: './test-results',
  reporter: [['list']],
  retries: 0,
});

const nais = defineConfig({
  ...baseConfig,

  forbidOnly: true,
  maxFailures: 0,
  outputDir: '/tmp/test-results',
  reporter: [
    ['list'],
    slackReporter({ botName: 'Klang E2E', iconUrl: 'navikt/klang/main/frontend/assets/logo192.png' }),
    statusReporter({ name: 'Klang E2E' }),
  ],
  retries: 1,
});

export default isInNais ? nais : local;
