import { UI_DOMAIN } from '@app/config/env';
import type { Page } from '@playwright/test';

const MAX_LOGIN_ATTEMPTS = 3;

export const logIn = async (page: Page, id: string): Promise<void> => {
  let lastError: unknown;

  const initialUrl = page.url();

  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt++) {
    try {
      if (page.url() !== initialUrl) {
        // Navigate to initial URL before attempting login
        await page.goto(initialUrl, { timeout: 30_000 });
      }

      await attemptLogIn(page, id);
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `Login attempt ${attempt}/${MAX_LOGIN_ATTEMPTS} failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  throw lastError;
};

const attemptLogIn = async (page: Page, id: string): Promise<void> => {
  const isLoggedIn = await checkLoggedIn(page);

  if (isLoggedIn) {
    return;
  }

  await page.getByText('Logg inn', { exact: true }).click();
  await page.getByText('TestID på nivå høyt').click();
  await page.getByLabel('Personidentifikator (syntetisk)').fill(id);
  await page.getByText('Autentiser').click();
  await page.waitForURL(`${UI_DOMAIN}/**`, { timeout: 30_000 });

  const loggedIn = await checkLoggedIn(page);

  if (!loggedIn) {
    throw new Error('Login flow completed but user is not logged in');
  }
};

export const checkLoggedIn = async (page: Page) => {
  try {
    const decoratorHeader = page.locator('#decorator-header');
    const logOut = decoratorHeader.getByText('Logg ut', { exact: true });
    const logIn = decoratorHeader.getByText('Logg inn', { exact: true });

    // Wait for either "Logg ut" or "Logg inn" to be visible to determine login state
    await logOut.or(logIn).waitFor({ state: 'visible' });

    return await logOut.isVisible();
  } catch {
    return false;
  }
};
