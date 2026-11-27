import { expect, test } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import {
  NAV_KLAGE_URL,
  NOT_FOUND_PAGE_EN,
  NOT_FOUND_PAGE_NB,
  NOT_FOUND_PAGE_NN,
  type NotFoundPageTexts,
  verifyNotFoundPage,
} from '@/fixtures/not-found-page';

interface NotFoundPath {
  path: string;
  texts: NotFoundPageTexts;
}

const UNKNOWN_PATHS: NotFoundPath[] = [
  { path: '/does-not-exist', texts: NOT_FOUND_PAGE_NB },
  { path: '/nb/finnes-ikke', texts: NOT_FOUND_PAGE_NB },
  { path: '/nn/finst-ikkje', texts: NOT_FOUND_PAGE_NN },
  { path: '/en/does-not-exist', texts: NOT_FOUND_PAGE_EN },
];

/** Parent routes of real pages, without a page of their own. */
const PARENT_PATHS: NotFoundPath[] = [
  '/nb',
  '/nb/klage',
  '/nb/anke',
  '/nb/ettersendelse',
  '/nb/ettersendelse/anke',
  '/nb/sak',
].map((path) => ({ path, texts: NOT_FOUND_PAGE_NB }));

const testNotFound = ({ path, texts }: NotFoundPath) => {
  test(`${path} svarer med 404 uten videresending`, async ({ request }) => {
    const response = await request.get(`${UI_DOMAIN}${path}`, { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('text/html');
  });

  test(`${path} viser 404-side med knapp til Klage og anke`, async ({ page }) => {
    const response = await page.goto(`${UI_DOMAIN}${path}`);

    expect(response?.status()).toBe(404);
    expect(new URL(page.url()).pathname).toBe(path);

    await verifyNotFoundPage(page, texts);
  });
};

test.describe('Finner ikke siden', () => {
  // Unknown pages must be reachable without login.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Ukjente sider', () => {
    for (const notFoundPath of UNKNOWN_PATHS) {
      testNotFound(notFoundPath);
    }
  });

  test.describe('Foreldreruter', () => {
    for (const notFoundPath of PARENT_PATHS) {
      testNotFound(notFoundPath);
    }
  });
});

test.describe('Forside', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/ viser oversikt over ytelser uten innlogging', async ({ page }) => {
    const response = await page.goto(`${UI_DOMAIN}/`);

    expect(response?.status()).toBe(404);
    expect(new URL(page.url()).pathname).toBe('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Oversikt over ytelser' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('link', { name: NAV_KLAGE_URL, exact: true })).toHaveAttribute('href', NAV_KLAGE_URL);
    await expect(page.getByRole('heading', { name: NOT_FOUND_PAGE_NB.title })).toHaveCount(0);
  });
});
