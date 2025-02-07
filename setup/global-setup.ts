import { type Page, type ViewportSize, chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test/reporter';
import { DEV_DOMAIN, USE_DEV } from '../tests/functions';
import { getLoggedInPage } from '../tests/helpers';
import { userSaksbehandler } from '../tests/test-data';

export const SCREEN_SIZE: ViewportSize = { width: 2560, height: 2000 };

const globalSetup = async (config: FullConfig) => {
  const { storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: SCREEN_SIZE,
    screen: SCREEN_SIZE,
  });

  await getLoggedInPage(page, userSaksbehandler);

  if (typeof storageState === 'string') {
    if (!USE_DEV) {
      await setLocalhostCookie(page);
    }

    await page.context().storageState({ path: storageState });
  }

  await browser.close();
};

// biome-ignore lint/style/noDefaultExport: https://playwright.dev/docs/test-global-setup-teardown
export default globalSetup;

const setLocalhostCookie = async (page: Page) => {
  const cookies = await page.context().cookies(DEV_DOMAIN);

  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error(`Did not find any cookies for ${DEV_DOMAIN}`);
  }

  if (cookies.length > 1) {
    throw new Error(`Found more than one cookie for ${DEV_DOMAIN}`);
  }

  await page.context().clearCookies();

  await page.context().addCookies([{ ...cookies[0], domain: 'localhost' }]);
};
