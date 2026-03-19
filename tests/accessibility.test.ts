import { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { test } from '@app/fixtures/registrering/fixture';
import { Type } from '@app/fixtures/registrering/klang-page';
import { testUser } from '@app/testdata/user';
import AxeBuilder from '@axe-core/playwright';
import { expect } from 'playwright/test';

const CASES = [
  { type: Type.Klage, ytelse: Innsendingsytelse.TOLKING_FOR_DOVE_DOVBLINDE_OG_HORSELSHEMMEDE },
  { type: Type.Anke, ytelse: Innsendingsytelse.SERVICEHUND },
  { type: Type.Klageettersendelse, ytelse: Innsendingsytelse.SENTER_FOR_JOBBMESTRING },
  { type: Type.Ankeettersendelse, ytelse: Innsendingsytelse.FORERHUND },
];

test.describe('Tilgjengelighet innlogget', () => {
  test.setTimeout(60_000);

  CASES.forEach(({ type, ytelse }) => {
    test(type, async ({ page, klangPage }) => {
      await klangPage.createLoggedInCase(type, ytelse);

      const axeBuilder = new AxeBuilder({ page });

      expect((await axeBuilder.analyze()).violations).toEqual([]);
      await klangPage.insertBegrunnelse('Reason.');
      await klangPage.insertVedtaksdato('01.02.2025');

      if (type === Type.Klageettersendelse) {
        await klangPage.checkHarMottattBrevCheckbox();
      }

      await klangPage.goToOppsummering();
      expect(page.url().endsWith('/oppsummering')).toBe(true);
      expect((await axeBuilder.analyze()).violations).toEqual([]);

      await klangPage.sendInn();
      expect(page.url().endsWith('/kvittering')).toBe(true);
      expect((await axeBuilder.analyze()).violations).toEqual([]);
    });
  });
});

test.describe('Tilgjengelighet uinnlogget', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(60_000);

  CASES.forEach(({ type, ytelse }) => {
    test(type, async ({ page, klangPage }) => {
      await klangPage.createCase(type, ytelse);

      const axeBuilder = new AxeBuilder({ page });

      expect((await axeBuilder.analyze()).violations).toEqual([]);
      await klangPage.insertIdNumber(testUser.id);
      await klangPage.insertFirstName('First');
      await klangPage.insertLastName('Last');
      await klangPage.insertBegrunnelse('Reason.');
      await klangPage.insertVedtaksdato('01.02.2025');

      if (type === Type.Klageettersendelse) {
        await klangPage.checkHarMottattBrevCheckbox();
      }

      await klangPage.goToOppsummering();

      expect(page.url().endsWith('/oppsummering')).toBe(true);
      expect((await axeBuilder.analyze()).violations).toEqual([]);

      await klangPage.checkJegForstårCheckbox();
      await klangPage.downloadPdf();

      expect(page.url().endsWith('/innsending')).toBe(true);
      expect((await axeBuilder.analyze()).violations).toEqual([]);
    });
  });
});
