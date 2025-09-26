import { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { test } from '@app/fixtures/registrering/fixture';
import { Type } from '@app/fixtures/registrering/klang-page';
import { testUser } from '@app/testdata/user';

test.describe('Uinnlogget', () => {
  // Don't reuse logged in state for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Klage', async ({ klangPage }) => {
    await klangPage.createCase(Type.Klage, Innsendingsytelse.BARNEBIDRAG_OG_BIDRAGSFORSKUDD);
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

  test('Anke', async ({ klangPage }) => {
    await klangPage.createCase(Type.Anke, Innsendingsytelse.BARNEPENSJON);
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
    await klangPage.createCase(Type.Klageettersendelse, Innsendingsytelse.BARNETRYGD);
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
    await klangPage.createCase(Type.Ankeettersendelse, Innsendingsytelse.BIDRAGSFORSKUDD);
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
    await klangPage.createCase(Type.Klage, Innsendingsytelse.BIDRAG_TIL_SARLIGE_UTGIFTER);
    await klangPage.insertIdNumber(testUser.id);
    await klangPage.insertFirstName('Vedtaksuenig');
    await klangPage.insertLastName('Sytersen');
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
