import type { BrowserContext, Page } from '@playwright/test';

export const dismissConsentBanner = async (page: Page, context: BrowserContext) => {
  const cookies = await context.cookies();
  const hasConsentCookie = cookies.some((cookie) => cookie.name === 'navno-consent');

  if (!hasConsentCookie) {
    await page.getByTestId('consent-banner-refuse-optional').click();
  }
};
