import { Innsendingsytelse } from '../fixtures/innsendingsytelse';
import { test } from '../fixtures/registrering/fixture';

test.describe('Uinnlogget med ferdigutfylt saksnummer', () => {
  // Don't reuse logged in state for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Klage', async ({ klangPage }) => {
    await klangPage.createCase('klage', Innsendingsytelse.BILSTONAD, '6969');
    await klangPage.verifyFerdigUtfyltSaksnummer();
    await klangPage.changeFerdigUtfyltSaksnummer('1337');
    await klangPage.verifyBegrunnelse();
  });

  test('Anke', async ({ klangPage }) => {
    await klangPage.createCase('anke', Innsendingsytelse.DAGPENGER, '6969');
    await klangPage.verifyFerdigUtfyltSaksnummer();
    await klangPage.changeFerdigUtfyltSaksnummer('1337');
    await klangPage.verifyBegrunnelse();
  });

  test('Klageettersendelse', async ({ klangPage }) => {
    await klangPage.createCase('klageettersendelse', Innsendingsytelse.DAGPENGER_TILBAKEBETALING_FORSKUDD, '6969');
    await klangPage.verifyFerdigUtfyltSaksnummer();
    await klangPage.changeFerdigUtfyltSaksnummer('1337');
    await klangPage.verifyBegrunnelse();
  });

  test('Ankeettersendelse', async ({ klangPage }) => {
    await klangPage.createCase('ankeettersendelse', Innsendingsytelse.EKTEFELLEBIDRAG, '6969');
    await klangPage.verifyFerdigUtfyltSaksnummer();
    await klangPage.changeFerdigUtfyltSaksnummer('1337');
    await klangPage.verifyBegrunnelse();
  });
});
