import { expect, type Page } from '@playwright/test';

export const NAV_KLAGE_URL = 'https://www.ekstern.dev.nav.no/klage';

export interface NotFoundPageTexts {
  title: string;
  description: string;
  goToNavKlage: string;
  href: string;
}

export const NOT_FOUND_PAGE_NB: NotFoundPageTexts = {
  title: 'Finner ikke siden',
  description: 'Siden du ble sendt til, finnes ikke.',
  goToNavKlage: 'Gå til Klage og anke',
  href: NAV_KLAGE_URL,
};

export const NOT_FOUND_PAGE_NN: NotFoundPageTexts = {
  title: 'Finn ikkje sida',
  description: 'Sida du vart send til, finst ikkje.',
  goToNavKlage: 'Gå til Klage og anke',
  href: `${NAV_KLAGE_URL}/nn`,
};

export const NOT_FOUND_PAGE_EN: NotFoundPageTexts = {
  title: 'Page not found',
  description: 'The page you were sent to does not exist.',
  goToNavKlage: 'Go to Complaint and appeal',
  href: `${NAV_KLAGE_URL}/en`,
};

export const verifyNotFoundPage = async (page: Page, { title, description, goToNavKlage, href }: NotFoundPageTexts) => {
  const main = page.locator('main');

  await expect(main.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(main.getByText(description, { exact: true })).toBeVisible();
  // Aksel Button with as="a" has role button.
  const navKlageButton = main.getByRole('button', { name: goToNavKlage, exact: true });
  await expect(navKlageButton).toHaveAttribute('href', href);
  await expect(navKlageButton).toHaveAttribute('data-variant', 'primary');
  await expect(page).toHaveTitle(title);
  await expect(page.locator('#decorator-header')).toBeVisible();
  await expect(page.locator('#decorator-footer')).toBeVisible();
};
