import { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { test } from '@app/fixtures/registrering/fixture';
import { Type } from '@app/fixtures/registrering/klang-case';

const CASES = [
  { type: Type.Klage, ytelse: Innsendingsytelse.ARBEIDSRETTET_REHABILITERING },
  { type: Type.Anke, ytelse: Innsendingsytelse.ARBEIDSTRENING },
  { type: Type.Klageettersendelse, ytelse: Innsendingsytelse.AVKLARING },
  { type: Type.Ankeettersendelse, ytelse: Innsendingsytelse.AVTALEFESTET_PENSJON_PRIVAT },
  { type: Type.Klageettersendelse, ytelse: Innsendingsytelse.AVTALEFESTET_PENSJON_SPK, harMottattBrev: true },
  { type: Type.Ankeettersendelse, ytelse: Innsendingsytelse.BARNEBIDRAG, harMottattBrev: true },
] as const;

test.describe('Innlogget med ferdigutfylt saksnummer', () => {
  test.slow(); // createLoggedInCase does create/delete/create with multiple navigations

  CASES.forEach(({ type, ytelse, ...rest }) => {
    const harMottattBrev = 'harMottattBrev' in rest ? rest.harMottattBrev : undefined;
    const name = harMottattBrev ? `${type} med mottatt brev` : type;

    test(name, async ({ klangCase }) => {
      await klangCase.createLoggedInCase(type, ytelse, '6969', harMottattBrev ?? null);

      if (harMottattBrev) {
        await klangCase.begrunnelse.verify();
      }

      await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');

      if (type === Type.Klageettersendelse) {
        await klangCase.begrunnelse.checkHarMottattBrevCheckbox(!harMottattBrev);
      }

      await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');

      await klangCase.begrunnelse.uploadAttachments();

      await klangCase.begrunnelse.verify();

      await klangCase.begrunnelse.submit();
      await klangCase.oppsummering.verify();
      await klangCase.oppsummering.sendInn();
      await klangCase.kvittering.verify();
      await klangCase.kvittering.downloadPdf();
    });
  });
});
