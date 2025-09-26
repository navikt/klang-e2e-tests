import type { Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test/reporter';
import { DEV_DOMAIN, USE_LOCAL } from '../config/env';
import { logIn, verifyLogin } from '../fixtures/registrering/login-page';
import { testUser } from '../testdata/user';

const globalSetup = async (config: FullConfig) => {
  const { storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await logIn(page, testUser.id, 'nb/klage/alderspensjon/begrunnelse');
  await verifyLogin(page, testUser);

  if (typeof storageState === 'string') {
    if (USE_LOCAL) {
      await setLocalhostCookie(page);
    }

    await page.context().storageState({ path: storageState });
  }

  await browser.close();
};

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
