import { expect } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import { Innsendingsytelse } from '@/fixtures/innsendingsytelse';
import { test } from '@/fixtures/registrering/fixture';
import { Type } from '@/fixtures/registrering/shared-state';
import { TEST_USER } from '@/testdata/user';

const CASES = [
  { type: Type.Klage, ytelse: Innsendingsytelse.BILSTONAD },
  { type: Type.Anke, ytelse: Innsendingsytelse.DAGPENGER },
  { type: Type.Klageettersendelse, ytelse: Innsendingsytelse.DAGPENGER_TILBAKEBETALING_FORSKUDD },
  { type: Type.Ankeettersendelse, ytelse: Innsendingsytelse.EKTEFELLEBIDRAG },
];

test.describe('Uinnlogget med ferdigutfylt saksnummer', () => {
  // Don't reuse logged in state for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  CASES.forEach(({ type, ytelse }) => {
    test(type, async ({ klangCase }) => {
      await test.step('Create case', async () => {
        await klangCase.createCase(type, ytelse, '6969');
      });

      await test.step('Begrunnelse', async () => {
        await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
        await klangCase.begrunnelse.insertFirstName('Vedtaksuenig');
        await klangCase.begrunnelse.insertLastName('Sytersen');
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');

        if (type === Type.Klageettersendelse) {
          await klangCase.begrunnelse.checkHarMottattBrevCheckbox();
        }

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

  test.describe('Bytte av dyplenkedata', () => {
    CASES.forEach(({ type, ytelse }) => {
      test(type, async ({ klangCase, page }) => {
        test.slow(); // Navigation retries may be needed under dev server load

        await test.step('Create case', async () => {
          await klangCase.createCase(type, ytelse, '1st_saksnummer', null);
        });

        await test.step('Begrunnelse (initial deep link)', async () => {
          await klangCase.begrunnelse.verify();

          expect(page.url()).toBe(`${UI_DOMAIN}/nb/${type}/${ytelse}/begrunnelse`);
        });

        await test.step('Begrunnelse (new deep link)', async () => {
          await klangCase.setDeepLinkParams('new_saksnummer', true);
          await klangCase.begrunnelse.verify();
          await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
          await klangCase.begrunnelse.insertFirstName('Vedtaksuenig');
          await klangCase.begrunnelse.insertLastName('Sytersen');
          await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');
          await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
          await klangCase.begrunnelse.checkVedleggCheckbox();
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
  });

  test.describe('Bevaring av dyplenkedata fra uinnlogget til innlogget', () => {
    CASES.forEach(({ type, ytelse }) => {
      test(type, async ({ klangCase, page }) => {
        test.slow(); // This test does a full IdP login + multiple navigations

        await test.step('Create case', async () => {
          await klangCase.createCase(type, ytelse, 'initial_saksnummer', true);
        });

        await test.step('Begrunnelse (uinnlogget)', async () => {
          await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
          await klangCase.begrunnelse.verify();

          expect(page.url()).toBe(`${UI_DOMAIN}/nb/${type}/${ytelse}/begrunnelse`);
        });

        await test.step('Log in', async () => {
          await klangCase.logIn();
        });

        await test.step('Begrunnelse (innlogget, new deep link)', async () => {
          await klangCase.setDeepLinkParams('new_saksnummer', true);
          await klangCase.begrunnelse.verify();
          await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');
          await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
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
});
