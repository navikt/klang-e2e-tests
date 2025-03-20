import { expect } from '@playwright/test';
import { UI_DOMAIN } from '../config/env';
import { Innsendingsytelse } from '../fixtures/innsendingsytelse';
import { test } from '../fixtures/registrering/fixture';
import { testUser } from '../testdata/user';

test.describe('Uinnlogget med ferdigutfylt saksnummer', () => {
  // Don't reuse logged in state for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Klage', async ({ klangPage }) => {
    await klangPage.createCase('klage', Innsendingsytelse.BILSTONAD, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Anke', async ({ klangPage }) => {
    await klangPage.createCase('anke', Innsendingsytelse.DAGPENGER, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Klageettersendelse', async ({ klangPage }) => {
    await klangPage.createCase('klageettersendelse', Innsendingsytelse.DAGPENGER_TILBAKEBETALING_FORSKUDD, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Ankeettersendelse', async ({ klangPage }) => {
    await klangPage.createCase('ankeettersendelse', Innsendingsytelse.EKTEFELLEBIDRAG, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Bytte av dyplenkedata', async ({ klangPage, page }) => {
    const ytelse = Innsendingsytelse.ENGANGSSTONAD;

    await klangPage.createCase('klageettersendelse', ytelse, '1st_saksnummer', '1st_sakstype', '1st_fagsystem', null);

    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();

    expect(page.url()).toBe(`${UI_DOMAIN}/nb/ettersendelse/klage/${ytelse}/begrunnelse`);

    await klangPage.setDeepLinkParams('new_saksnummer', 'new_sakstype', 'new_fagsystem', true);
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Bevaring av dyplenkedata fra uinnlogget til innlogget', async ({ klangPage, page, loginPage }) => {
    const ytelse = Innsendingsytelse.ENSLIG_MOR_ELLER_FAR;

    const saksnummer = 'initial_saksnummer';
    const sakstype = 'initial_sakstype';
    const fagsystem = 'initial_fagsystem';
    const caseIsAtKA = true;

    await klangPage.createCase('klageettersendelse', ytelse, saksnummer, sakstype, fagsystem, caseIsAtKA);

    await klangPage.verifySaksnummer();
    await klangPage.insertIdNumber(testUser.id);
    await klangPage.verifyBegrunnelse();

    expect(page.url()).toBe(`${UI_DOMAIN}/nb/ettersendelse/klage/${ytelse}/begrunnelse`);

    const klanke = page.waitForResponse('**/api/klanker/**');
    await loginPage.logIn();
    await loginPage.verifyLogin();
    klangPage.setLoggedIn(true);
    const response = await klanke;

    const json: PartialKlanke = await response.json();

    expect(json.internalSaksnummer).toBe(saksnummer);
    expect(json.sakSakstype).toBe(sakstype);
    expect(json.sakFagsaksystem).toBe(fagsystem);
    expect(json.caseIsAtKA).toBe(caseIsAtKA);

    const newSaksnummer = 'new_saksnummer';
    const newSakstype = 'new_sakstype';
    const newFagsystem = 'new_fagsystem';
    const newCaseIsAtKA = true;

    await klangPage.setDeepLinkParams(newSaksnummer, newSakstype, newFagsystem, newCaseIsAtKA);

    await klangPage.verifySaksnummer();

    const newKlanke = page.waitForResponse('**/api/klanker/**');
    await klangPage.verifyBegrunnelse();
    const newResponse = await newKlanke;

    const newJson: PartialKlanke = await newResponse.json();

    expect(newJson.internalSaksnummer).toBe(newSaksnummer);
    expect(newJson.sakSakstype).toBe(newSakstype);
    expect(newJson.sakFagsaksystem).toBe(newFagsystem);
    expect(newJson.caseIsAtKA).toBe(newCaseIsAtKA);
  });
});

type PartialKlanke = {
  internalSaksnummer: string | null;
  sakSakstype: string | null;
  sakFagsaksystem: string | null;
  caseIsAtKA: boolean | null;
};
