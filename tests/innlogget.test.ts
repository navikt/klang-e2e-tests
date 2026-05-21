import { Innsendingsytelse } from '@/fixtures/innsendingsytelse';
import { test } from '@/fixtures/registrering/fixture';
import { Type } from '@/fixtures/registrering/klang-case';

const CASES = [
  { type: Type.Klage, ytelse: Innsendingsytelse.ALDERSPENSJON },
  { type: Type.Anke, ytelse: Innsendingsytelse.ARBEID_MED_STOTTE },
  { type: Type.Klageettersendelse, ytelse: Innsendingsytelse.ARBEIDSAVKLARINGSPENGER },
  { type: Type.Ankeettersendelse, ytelse: Innsendingsytelse.ARBEIDSFORBEREDENDE_TRENING },
];

test.describe('Innlogget', () => {
  test.slow();

  CASES.forEach(({ type, ytelse }) => {
    test(type, async ({ klangCase }) => {
      await test.step('Create case', async () => {
        await klangCase.createLoggedInCase(type, ytelse);
      });

      await test.step('Begrunnelse', async () => {
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');

        if (type === Type.Klageettersendelse) {
          await klangCase.begrunnelse.checkHarMottattBrevCheckbox();
        }

        await klangCase.begrunnelse.insertSaksnummer('1337');
        await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
        await klangCase.begrunnelse.uploadAttachments();
        await klangCase.begrunnelse.verify();
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
