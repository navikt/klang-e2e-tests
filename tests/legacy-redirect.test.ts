import { expect } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import { Innsendingsytelse } from '@/fixtures/innsendingsytelse';
import { test } from '@/fixtures/registrering/fixture';
import { getCasePath, getLegacyKlageettersendelsePath, Type } from '@/fixtures/registrering/shared-state';
import { TEST_USER } from '@/testdata/user';

const YTELSE = Innsendingsytelse.DAGPENGER;
const LEGACY_PATH = getLegacyKlageettersendelsePath(YTELSE);
const CASE_PATH = getCasePath(Type.Klageettersendelse, YTELSE);

interface Redirect {
  from: string;
  to: string;
}

const REDIRECTS: Redirect[] = [
  { from: LEGACY_PATH, to: CASE_PATH },
  { from: `${LEGACY_PATH}/begrunnelse`, to: `${CASE_PATH}/begrunnelse` },
  { from: `${LEGACY_PATH}/oppsummering`, to: `${CASE_PATH}/oppsummering` },
  { from: `${LEGACY_PATH}/innsending`, to: `${CASE_PATH}/innsending` },
  { from: `${LEGACY_PATH}?saksnummer=1337&ka`, to: `${CASE_PATH}?saksnummer=1337&ka` },
  {
    from: `/en/ettersendelse/klage/${YTELSE.toUpperCase()}/BEGRUNNELSE?saksnummer=1337`,
    to: `/en/ettersendelse/${YTELSE}/begrunnelse?saksnummer=1337`,
  },
];

const NOT_REDIRECTED = ['/nb/ettersendelse/klage/ukjent', `${LEGACY_PATH}/ukjent`];

test.describe('Gamle URL-er for klageettersendelse', () => {
  test.describe('Videresending', () => {
    for (const { from, to } of REDIRECTS) {
      test(`${from} videresendes til ${to}`, async ({ request }) => {
        const response = await request.get(`${UI_DOMAIN}${from}`, { maxRedirects: 0 });

        expect(response.status()).toBe(302);

        const location = new URL(response.headers().location ?? '', UI_DOMAIN);

        expect(`${location.pathname}${location.search}`).toBe(to);
      });
    }

    for (const path of NOT_REDIRECTED) {
      test(`${path} videresendes ikke`, async ({ request }) => {
        const response = await request.get(`${UI_DOMAIN}${path}`, { maxRedirects: 0 });

        expect(response.status()).toBe(404);
      });
    }
  });

  test.describe('Uinnlogget', () => {
    // Don't reuse logged in state for these tests.
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Med steg videresendes til samme steg', async ({ page }) => {
      await page.goto(`${UI_DOMAIN}${LEGACY_PATH}/begrunnelse`);
      await page.waitForURL((url) => url.pathname === `${CASE_PATH}/begrunnelse`);
      await expect(page.getByLabel('Har du noe å legge til?')).toBeVisible();
    });

    test('Uten steg videresendes og beholder dyplenkedata', async ({ klangCase }) => {
      await test.step('Create case', async () => {
        await klangCase.createLoggedOutLegacyKlageettersendelseCase(YTELSE, '1337', true);
      });

      await test.step('Begrunnelse', async () => {
        await klangCase.begrunnelse.verify();
        await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
        await klangCase.begrunnelse.insertFirstName('Vedtaksuenig');
        await klangCase.begrunnelse.insertLastName('Sytersen');
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');
        await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
        await klangCase.begrunnelse.checkVedleggCheckbox();
        await klangCase.begrunnelse.verify();
        await klangCase.begrunnelse.submit();
      });

      await test.step('Oppsummering', async () => {
        await klangCase.oppsummering.verify();
        await klangCase.oppsummering.checkJegForstårCheckbox();
        await klangCase.oppsummering.download();
      });

      await test.step('Kvittering', async () => {
        await klangCase.kvittering.verify();
      });
    });
  });

  test.describe('Innlogget', () => {
    test.slow(); // createLoggedInCase does create/delete/create with multiple navigations

    test('Videresendes og beholder dyplenkedata', async ({ klangCase }) => {
      await test.step('Create case', async () => {
        await klangCase.createLoggedInLegacyKlageettersendelseCase(YTELSE, '6969', true);
      });

      await test.step('Begrunnelse', async () => {
        await klangCase.begrunnelse.verify();
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');
        await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
        await klangCase.begrunnelse.uploadAttachments();
        await klangCase.begrunnelse.verify();
        await klangCase.begrunnelse.submit();
      });

      await test.step('Oppsummering', async () => {
        await klangCase.oppsummering.verify();
        await klangCase.oppsummering.sendInn();
      });

      await test.step('Kvittering', async () => {
        await klangCase.kvittering.verify();
        await klangCase.kvittering.downloadPdf();
      });
    });
  });
});
