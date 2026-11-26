import { expect, type Page } from '@playwright/test';

export const NAV_KLAGE_URL = 'https://www.ekstern.dev.nav.no/klage';

export interface NotFoundPageTexts {
  title: string;
  description: string;
  findCorrectPage: string;
  href: string;
}

export const NOT_FOUND_PAGE_NB: NotFoundPageTexts = {
  title: 'Finner ikke siden',
  description: 'Siden du ble sendt til, finnes ikke.',
  findCorrectPage: 'Du finner kanskje riktig side på nav.no/klage.',
  href: NAV_KLAGE_URL,
};

export const NOT_FOUND_PAGE_NN: NotFoundPageTexts = {
  title: 'Finn ikkje sida',
  description: 'Sida du vart send til, finst ikkje.',
  findCorrectPage: 'Du finn kanskje rett side på nav.no/klage.',
  href: `${NAV_KLAGE_URL}/nn`,
};

export const NOT_FOUND_PAGE_EN: NotFoundPageTexts = {
  title: 'Page not found',
  description: 'The page you were sent to does not exist.',
  findCorrectPage: 'You may find the correct page at nav.no/klage.',
  href: NAV_KLAGE_URL,
};

export const verifyNotFoundPage = async (
  page: Page,
  { title, description, findCorrectPage, href }: NotFoundPageTexts,
) => {
  const main = page.locator('main');

  await expect(main.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(main.getByText(description, { exact: true })).toBeVisible();
  await expect(main.getByText(findCorrectPage, { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'nav.no/klage', exact: true })).toHaveAttribute('href', href);
  await expect(page).toHaveTitle(title);
  await expect(page.locator('#decorator-header')).toBeVisible();
  await expect(page.locator('#decorator-footer')).toBeVisible();
};
