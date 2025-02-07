import { Innsendingsytelse } from '../fixtures/innsendingsytelse';
import { test } from '../fixtures/registrering/fixture';

test.describe('Innlogget', () => {
  test('Klage', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('klage', Innsendingsytelse.ALDERSPENSJON);

    await klangPage.checkAvslagCheckbox();
    await klangPage.checkUtbetaltCheckbox();
    await klangPage.checkUenigCheckbox();
    await klangPage.checkTilbakebetalingCheckbox();

    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');

    await klangPage.uploadAttachments();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
  });

  test('Anke', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('anke', Innsendingsytelse.ARBEID_MED_STOTTE);

    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');

    await klangPage.uploadAttachments();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
    await klangPage.sendInn();
    await klangPage.downloadPdf();
  });

  test('Klageettersendelse', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('klageettersendelse', Innsendingsytelse.ARBEIDSAVKLARINGSPENGER);

    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.checkHarMottattBrevCheckbox();
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');

    await klangPage.uploadAttachments();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
    await klangPage.sendInn();
    await klangPage.downloadPdf();
  });

  test('Ankeettersendelse', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('ankeettersendelse', Innsendingsytelse.ARBEIDSFORBEREDENDE_TRENING);

    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');

    await klangPage.uploadAttachments();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
    await klangPage.sendInn();
    await klangPage.downloadPdf();
  });
});
