import { Innsendingsytelse } from '../fixtures/innsendingsytelse';
import { test } from '../fixtures/registrering/fixture';

test.describe('Innlogget med ferdigutfylt saksnummer', () => {
  test('Klage', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('klage', Innsendingsytelse.ARBEIDSRETTET_REHABILITERING, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Anke', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('anke', Innsendingsytelse.ARBEIDSTRENING, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Klageettersendelse', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('klageettersendelse', Innsendingsytelse.AVKLARING, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyMottattBrev();
    await klangPage.verifyBegrunnelse();
  });

  test('Ankeettersendelse', async ({ klangPage }) => {
    await klangPage.createLoggedInCase('ankeettersendelse', Innsendingsytelse.AVTALEFESTET_PENSJON_PRIVAT, '6969');
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });

  test('Klageettersendelse med mottatt brev', async ({ klangPage }) => {
    await klangPage.createLoggedInCase(
      'klageettersendelse',
      Innsendingsytelse.AVTALEFESTET_PENSJON_SPK,
      '6969',
      'sakstype',
      'fagsystem',
      true,
    );
    await klangPage.verifySaksnummer();
    await klangPage.verifyMottattBrev();
    await klangPage.checkHarMottattBrevCheckbox(false);
    await klangPage.verifyBegrunnelse();
  });

  test('Ankeettersendelse med mottatt brev', async ({ klangPage }) => {
    await klangPage.createLoggedInCase(
      'ankeettersendelse',
      Innsendingsytelse.BARNEBIDRAG,
      '6969',
      'sakstype',
      'fagsystem',
      true,
    );
    await klangPage.verifySaksnummer();
    await klangPage.verifyBegrunnelse();
  });
});
