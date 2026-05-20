import { UI_DOMAIN } from '@app/config/env';
import { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { test } from '@app/fixtures/registrering/fixture';
import { Type } from '@app/fixtures/registrering/klang-case';
import { TEST_USER } from '@app/testdata/user';
import { expect } from '@playwright/test';

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
      await klangCase.createCase(type, ytelse, '6969');

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
      await klangCase.oppsummering.verify();
      await klangCase.oppsummering.checkJegForstårCheckbox();
      await klangCase.oppsummering.download();
      await klangCase.kvittering.verify();
    });
  });

  test.describe('Bytte av dyplenkedata', () => {
    CASES.forEach(({ type, ytelse }) => {
      test(type, async ({ klangCase, page }) => {
        test.slow(); // Navigation retries may be needed under dev server load

        await klangCase.createCase(type, ytelse, '1st_saksnummer', null);

        await klangCase.begrunnelse.verify();

        expect(page.url()).toBe(`${UI_DOMAIN}/nb/${type}/${ytelse}/begrunnelse`);

        await klangCase.setDeepLinkParams('new_saksnummer', true);

        await klangCase.begrunnelse.verify();

        // Fill fields (deep link only provides saksnummer + harMottattBrev)
        await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
        await klangCase.begrunnelse.insertFirstName('Vedtaksuenig');
        await klangCase.begrunnelse.insertLastName('Sytersen');
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');
        await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
        await klangCase.begrunnelse.checkVedleggCheckbox();

        await klangCase.begrunnelse.submit();
        await klangCase.oppsummering.verify();
        await klangCase.oppsummering.checkJegForstårCheckbox();
        await klangCase.oppsummering.download();
        await klangCase.kvittering.verify();
      });
    });
  });

  test.describe('Bevaring av dyplenkedata fra uinnlogget til innlogget', () => {
    CASES.forEach(({ type, ytelse }) => {
      test(type, async ({ klangCase, page }) => {
        test.slow(); // This test does a full IdP login + multiple navigations

        await klangCase.createCase(type, ytelse, 'initial_saksnummer', true);

        await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
        await klangCase.begrunnelse.verify();

        expect(page.url()).toBe(`${UI_DOMAIN}/nb/${type}/${ytelse}/begrunnelse`);

        await klangCase.logIn();

        await klangCase.setDeepLinkParams('new_saksnummer', true);

        await klangCase.begrunnelse.verify();

        // Fill remaining fields (logged in provides personal info; deep link provides saksnummer + harMottattBrev)
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');
        await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');

        await klangCase.begrunnelse.submit();
        await klangCase.oppsummering.verify();
        await klangCase.oppsummering.sendInn();
        await klangCase.kvittering.verify();
        await klangCase.kvittering.downloadPdf();
      });
    });
  });
});
