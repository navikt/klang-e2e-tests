import { UI_DOMAIN } from '@app/config/env';
import { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { test } from '@app/fixtures/registrering/fixture';
import { Type } from '@app/fixtures/registrering/klang-page';
import { TEST_USER } from '@app/testdata/user';
import { expect } from '@playwright/test';

test.describe('Uinnlogget med ferdigutfylt saksnummer', () => {
  // Don't reuse logged in state for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Klage', async ({ klangPage }) => {
    await klangPage.createCase(Type.Klage, Innsendingsytelse.BILSTONAD, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Anke', async ({ klangPage }) => {
    await klangPage.createCase(Type.Anke, Innsendingsytelse.DAGPENGER, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Klageettersendelse', async ({ klangPage }) => {
    await klangPage.createCase(Type.Klageettersendelse, Innsendingsytelse.DAGPENGER_TILBAKEBETALING_FORSKUDD, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Ankeettersendelse', async ({ klangPage }) => {
    await klangPage.createCase(Type.Ankeettersendelse, Innsendingsytelse.EKTEFELLEBIDRAG, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Bytte av dyplenkedata', async ({ klangPage, page }) => {
    test.slow(); // Navigation retries may be needed under dev server load
    const ytelse = Innsendingsytelse.ENGANGSSTONAD;

    await klangPage.createCase(
      Type.Klageettersendelse,
      ytelse,
      '1st_saksnummer',
      '1st_sakstype',
      '1st_fagsystem',
      null,
    );

    await klangPage.verifyBegrunnelse();

    expect(page.url()).toBe(`${UI_DOMAIN}/nb/ettersendelse/klage/${ytelse}/begrunnelse`);

    await klangPage.setDeepLinkParams('new_saksnummer', 'new_sakstype', 'new_fagsystem', true);

    await klangPage.verifyBegrunnelse();
  });

  test('Bevaring av dyplenkedata fra uinnlogget til innlogget', async ({ klangPage, page }) => {
    test.slow(); // This test does a full IdP login + multiple navigations

    const ytelse = Innsendingsytelse.ENSLIG_MOR_ELLER_FAR;

    const saksnummer = 'initial_saksnummer';
    const sakstype = 'initial_sakstype';
    const fagsystem = 'initial_fagsystem';
    const caseIsAtKA = true;

    await klangPage.createCase(Type.Klageettersendelse, ytelse, saksnummer, sakstype, fagsystem, caseIsAtKA);

    await klangPage.insertIdNumber(TEST_USER.id);
    await klangPage.verifyBegrunnelse();

    expect(page.url()).toBe(`${UI_DOMAIN}/nb/ettersendelse/klage/${ytelse}/begrunnelse`);

    await klangPage.logIn();

    const newSaksnummer = 'new_saksnummer';
    const newSakstype = 'new_sakstype';
    const newFagsystem = 'new_fagsystem';
    const newCaseIsAtKA = true;

    await klangPage.setDeepLinkParams(newSaksnummer, newSakstype, newFagsystem, newCaseIsAtKA);

    await Promise.all([klangPage.verifyMottattBrev(), klangPage.verifyBegrunnelse()]);
  });
});
