import { Innsendingsytelse } from '../fixtures/innsendingsytelse';
import { test } from '../fixtures/registrering/fixture';
import { testUser } from '../testdata/user';

test.describe('Uinnlogget', () => {
  // Don't reuse logged in state for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Klage', async ({ klangPage }) => {
    await klangPage.createCase('klage', Innsendingsytelse.BARNEBIDRAG_OG_BIDRAGSFORSKUDD);
    await klangPage.insertIdNumber(testUser.id);
    await klangPage.insertFirstName('Vedtaksuenig');
    await klangPage.insertLastName('Sytersen');
    await klangPage.checkAvslagCheckbox();
    await klangPage.checkUtbetaltCheckbox();
    await klangPage.checkUenigCheckbox();
    await klangPage.checkTilbakebetalingCheckbox();
    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');
    await klangPage.checkVedleggCheckbox();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
    await klangPage.checkJegForstårCheckbox();

    await klangPage.downloadPdf();
  });

  test('Anke', async ({ klangPage }) => {
    await klangPage.createCase('anke', Innsendingsytelse.BARNEPENSJON);
    await klangPage.insertIdNumber(testUser.id);
    await klangPage.insertFirstName('Vedtaksuenig');
    await klangPage.insertLastName('Sytersen');
    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');
    await klangPage.checkVedleggCheckbox();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
    await klangPage.checkJegForstårCheckbox();

    await klangPage.downloadPdf();
  });

  test('Klageettersendelse', async ({ klangPage }) => {
    await klangPage.createCase('klageettersendelse', Innsendingsytelse.BARNETRYGD);
    await klangPage.insertIdNumber(testUser.id);
    await klangPage.insertFirstName('Vedtaksuenig');
    await klangPage.insertLastName('Sytersen');
    await klangPage.insertVedtaksdato('01.02.2025');

    await klangPage.checkHarMottattBrevCheckbox();
    await klangPage.insertSaksnummer('1337');

    await klangPage.insertBegrunnelse('Jeg er fortsatt uenig');
    await klangPage.checkVedleggCheckbox();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
    await klangPage.checkJegForstårCheckbox();

    await klangPage.downloadPdf();
  });

  test('Ankeettersendelse', async ({ klangPage }) => {
    await klangPage.createCase('ankeettersendelse', Innsendingsytelse.BIDRAGSFORSKUDD);
    await klangPage.insertIdNumber(testUser.id);
    await klangPage.insertFirstName('Vedtaksuenig');
    await klangPage.insertLastName('Sytersen');
    await klangPage.insertVedtaksdato('01.02.2025');

    await klangPage.insertSaksnummer('1337');

    await klangPage.insertBegrunnelse('Jeg er fortsatt uenig');
    await klangPage.checkVedleggCheckbox();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
    await klangPage.checkJegForstårCheckbox();

    await klangPage.downloadPdf();
  });

  test('Uinnlogget til innlogget', async ({ klangPage }) => {
    await klangPage.createCase('klage', Innsendingsytelse.BIDRAG_TIL_SARLIGE_UTGIFTER);
    await klangPage.insertIdNumber(testUser.id);
    await klangPage.insertFirstName('Vedtaksuenig');
    await klangPage.insertLastName('Sytersen');
    await klangPage.checkAvslagCheckbox();
    await klangPage.checkUtbetaltCheckbox();
    await klangPage.checkUenigCheckbox();
    await klangPage.checkTilbakebetalingCheckbox();
    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');
    await klangPage.checkVedleggCheckbox();

    await klangPage.verifyBegrunnelse();

    await klangPage.logIn();
    await klangPage.verifyLogin();

    await klangPage.verifyBegrunnelse();
  });
});
