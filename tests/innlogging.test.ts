import { expect, test } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import { Innsendingsytelse } from '@/fixtures/innsendingsytelse';
import { NOT_FOUND_PAGE_NB, verifyNotFoundPage } from '@/fixtures/not-found-page';

// Fixed ID so test titles are stable across workers. The case does not need to exist.
const SAK_ID = '00000000-0000-0000-0000-000000000000';

const LOGIN_REQUIRED_PATHS = [
  `/nb/sak/${SAK_ID}`,
  `/nb/sak/${SAK_ID}/begrunnelse`,
  `/nn/sak/${SAK_ID}/oppsummering`,
  `/en/sak/${SAK_ID}/kvittering`,
  `/nb/sak/${SAK_ID}/begrunnelse?saksnummer=1337&ka`,
];

const ANONYMOUS_PATHS = [
  `/nb/klage/${Innsendingsytelse.DAGPENGER}`,
  `/nn/anke/${Innsendingsytelse.DAGPENGER}/begrunnelse`,
  `/en/ettersendelse/${Innsendingsytelse.DAGPENGER}`,
];

test.describe('Innlogging', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Krever innlogging', () => {
    for (const path of LOGIN_REQUIRED_PATHS) {
      test(`${path} videresender til innlogging`, async ({ request }) => {
        const response = await request.get(`${UI_DOMAIN}${path}`, { maxRedirects: 0 });

        expect(response.status()).toBe(302);

        const location = new URL(response.headers().location ?? '', UI_DOMAIN);

        expect(location.origin).toBe(UI_DOMAIN);
        expect(location.pathname).toBe('/oauth2/login');
        expect(location.searchParams.get('redirect')).toBe(path);
      });
    }
  });

  test.describe('Krever ikke innlogging', () => {
    for (const path of ANONYMOUS_PATHS) {
      test(`${path} vises uten innlogging`, async ({ request }) => {
        const response = await request.get(`${UI_DOMAIN}${path}`, { maxRedirects: 0 });

        expect(response.status()).toBe(200);
      });
    }

    test('/nb/sak uten ID videresender ikke til innlogging', async ({ request }) => {
      const response = await request.get(`${UI_DOMAIN}/nb/sak`, { maxRedirects: 0 });

      expect(response.status()).toBe(404);
      expect(response.headers().location).toBeUndefined();
    });

    test('/nb/sak uten ID viser 404-side', async ({ page }) => {
      const response = await page.goto(`${UI_DOMAIN}/nb/sak`);

      expect(response?.status()).toBe(404);
      expect(new URL(page.url()).pathname).toBe('/nb/sak');

      await verifyNotFoundPage(page, NOT_FOUND_PAGE_NB);
    });
  });
});
