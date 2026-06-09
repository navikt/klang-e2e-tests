import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { Innsendingsytelse } from '@/fixtures/innsendingsytelse';
import { test } from '@/fixtures/registrering/fixture';
import { Type } from '@/fixtures/registrering/shared-state';
import { TEST_USER } from '@/testdata/user';

const CASES = [
  { type: Type.Klage, ytelse: Innsendingsytelse.TOLKING_FOR_DOVE_DOVBLINDE_OG_HORSELSHEMMEDE },
  { type: Type.Anke, ytelse: Innsendingsytelse.SERVICEHUND },
  { type: Type.Klageettersendelse, ytelse: Innsendingsytelse.SENTER_FOR_JOBBMESTRING },
  { type: Type.Ankeettersendelse, ytelse: Innsendingsytelse.FORERHUND },
];

test.describe('Tilgjengelighet innlogget', () => {
  test.setTimeout(60_000);

  CASES.forEach(({ type, ytelse }) => {
    test(type, async ({ page, klangCase }) => {
      await test.step('Create case', async () => {
        await klangCase.createLoggedInCase(type, ytelse);
      });

      const axeBuilder = new AxeBuilder({ page });

      await test.step('Begrunnelse', async () => {
        expect((await axeBuilder.analyze()).violations).toEqual([]);
        await klangCase.begrunnelse.insertBegrunnelse('Reason.');
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');

        if (type === Type.Klageettersendelse) {
          await klangCase.begrunnelse.checkHarMottattBrevCheckbox();
        }

        await klangCase.begrunnelse.submit();
      });

      await test.step('Oppsummering', async () => {
        expect(page.url().endsWith('/oppsummering')).toBe(true);
        expect((await axeBuilder.analyze()).violations).toEqual([]);

        await klangCase.oppsummering.sendInn();
      });

      await test.step('Kvittering', async () => {
        expect(page.url().endsWith('/kvittering')).toBe(true);
        expect((await axeBuilder.analyze()).violations).toEqual([]);
      });
    });
  });
});

test.describe('Tilgjengelighet uinnlogget', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(60_000);

  CASES.forEach(({ type, ytelse }) => {
    test(type, async ({ page, klangCase }) => {
      await test.step('Create case', async () => {
        await klangCase.createLoggedOutCase(type, ytelse);
      });

      const axeBuilder = new AxeBuilder({ page });

      await test.step('Begrunnelse', async () => {
        expect((await axeBuilder.analyze()).violations).toEqual([]);
        await klangCase.begrunnelse.insertIdNumber(TEST_USER.id);
        await klangCase.begrunnelse.insertFirstName('First');
        await klangCase.begrunnelse.insertLastName('Last');
        await klangCase.begrunnelse.insertBegrunnelse('Reason.');
        await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');

        if (type === Type.Klageettersendelse) {
          await klangCase.begrunnelse.checkHarMottattBrevCheckbox();
        }

        await klangCase.begrunnelse.submit();
      });

      await test.step('Oppsummering', async () => {
        expect(page.url().endsWith('/oppsummering')).toBe(true);
        expect((await axeBuilder.analyze()).violations).toEqual([]);

        await klangCase.oppsummering.checkJegForstårCheckbox();
        await klangCase.oppsummering.download();
      });

      await test.step('Innsending', async () => {
        expect(page.url().endsWith('/innsending')).toBe(true);
        expect((await axeBuilder.analyze()).violations).toEqual([]);
      });
    });
  });
});
