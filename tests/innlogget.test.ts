import { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { test } from '@app/fixtures/registrering/fixture';
import { Type } from '@app/fixtures/registrering/klang-page';

test.describe('Innlogget', () => {
  test('Klage', async ({ klangPage }) => {
    await klangPage.createLoggedInCase(Type.Klage, Innsendingsytelse.ALDERSPENSJON);

    await klangPage.insertVedtaksdato('01.02.2025');
    await klangPage.insertSaksnummer('1337');
    await klangPage.insertBegrunnelse('Fordi jeg ikke er enig');

    await klangPage.uploadAttachments();

    await klangPage.verifyBegrunnelse();

    await klangPage.goToOppsummering();
    await klangPage.verifyOppsummering();
  });

  test('Anke', async ({ klangPage }) => {
    await klangPage.createLoggedInCase(Type.Anke, Innsendingsytelse.ARBEID_MED_STOTTE);

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
    await klangPage.createLoggedInCase(Type.Klageettersendelse, Innsendingsytelse.ARBEIDSAVKLARINGSPENGER);

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
    await klangPage.createLoggedInCase(Type.Ankeettersendelse, Innsendingsytelse.ARBEIDSFORBEREDENDE_TRENING);

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
