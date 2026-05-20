import { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { test } from '@app/fixtures/registrering/fixture';
import { Type } from '@app/fixtures/registrering/klang-case';
import { TEST_USER } from '@app/testdata/user';

const CASES = [
  { type: Type.Klage, ytelse: Innsendingsytelse.BARNEBIDRAG_OG_BIDRAGSFORSKUDD },
  { type: Type.Anke, ytelse: Innsendingsytelse.BARNEPENSJON },
  { type: Type.Klageettersendelse, ytelse: Innsendingsytelse.BARNETRYGD },
  { type: Type.Ankeettersendelse, ytelse: Innsendingsytelse.BIDRAGSFORSKUDD },
];

test.describe('Uinnlogget', () => {
  // Don't reuse logged in state for these tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  CASES.forEach(({ type, ytelse }) => {
    test(type, async ({ klangCase }) => {
      await klangCase.createCase(type, ytelse);
      await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
      await klangCase.begrunnelse.insertFirstName('Vedtaksuenig');
      await klangCase.begrunnelse.insertLastName('Uenigvedtak');
      await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');

      if (type === Type.Klageettersendelse) {
        await klangCase.begrunnelse.checkHarMottattBrevCheckbox();
      }

      await klangCase.begrunnelse.insertSaksnummer('1337');
      await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
      await klangCase.begrunnelse.checkVedleggCheckbox();

      await klangCase.begrunnelse.verify();

      await klangCase.begrunnelse.submit();
      await klangCase.oppsummering.verify();
      await klangCase.oppsummering.checkJegForstårCheckbox();
      await klangCase.oppsummering.download();
      await klangCase.kvittering.verify();
    });
  });

  test.describe('til innlogget', () => {
    CASES.forEach(({ type, ytelse }) => {
      test(type, async ({ klangCase }) => {
        test.slow(); // Full IdP login flow
        await klangCase.createCase(type, ytelse);
        await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
        await klangCase.begrunnelse.insertFirstName('Vedtaksuenig');
        await klangCase.begrunnelse.insertLastName('Uenigvedtak');
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');

        if (type === Type.Klageettersendelse) {
          await klangCase.begrunnelse.checkHarMottattBrevCheckbox();
        }

        await klangCase.begrunnelse.insertSaksnummer('1337');
        await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
        await klangCase.begrunnelse.checkVedleggCheckbox();

        await klangCase.begrunnelse.verify();

        await klangCase.logIn();

        await klangCase.begrunnelse.verify();

        await klangCase.begrunnelse.submit();
        await klangCase.oppsummering.verify();
        await klangCase.oppsummering.sendInn();
        await klangCase.kvittering.verify();
        await klangCase.kvittering.downloadPdf();
      });
    });
  });
});
