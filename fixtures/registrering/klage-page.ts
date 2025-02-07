import test, { type Page, expect } from '@playwright/test';
import { finishedRequest } from '../helpers';
import type { GosysOppgaveQuery, Klagemulighet } from './types';

export class KlagePage {
  constructor(public readonly page: Page) {}

  setMottattVedtaksinstans = async (vedtaksdato: string) =>
    test.step(`Sett Mottatt vedtaksinstans: ${vedtaksdato}`, async () => {
      await this.page.waitForTimeout(1000);
      await this.page.getByLabel('Mottatt vedtaksinstans').fill(vedtaksdato);
    });

  setGosysOppgave = async ({
    frist,
    gjelder,
    oppgavetype,
    opprettet,
    opprettetAvEnhetsnr,
    tema,
    tildeltEnhetsnr,
  }: GosysOppgaveQuery) =>
    test.step('Velg Gosys-oppgave', async () => {
      const rows = this.page.getByRole('table', { name: 'Gosys-oppgaver' }).locator('tbody > tr');

      const oppgave = rows
        .filter({ has: this.page.locator('td:nth-of-type(2)').filter({ hasText: opprettet }) })
        .filter({ has: this.page.locator('td:nth-of-type(3)').filter({ hasText: frist }) })
        .filter({ has: this.page.locator('td:nth-of-type(4)').filter({ hasText: tema }) })
        .filter({ has: this.page.locator('td:nth-of-type(5)').filter({ hasText: gjelder }) })
        .filter({ has: this.page.locator('td:nth-of-type(6)').filter({ hasText: oppgavetype }) })
        .filter({ has: this.page.locator('td:nth-of-type(7)').filter({ hasText: tildeltEnhetsnr }) })
        .filter({ has: this.page.locator('td:nth-of-type(8)').filter({ hasText: opprettetAvEnhetsnr }) });

      await oppgave.waitFor();

      await oppgave.getByText('Velg').click();

      const button = oppgave.getByRole('button').last();

      await expect(button).toHaveAttribute('title', 'Valgt');
    });

  selectKlage = async () =>
    test.step('Velg type: klage', async () => {
      await this.page.getByRole('radio', { name: 'Klage', exact: true }).click();

      return this.page.getByText('Velg vedtaket klagen gjelder');
    });

  selectMulighet = ({ fagsakId, tema, vedtakInnstilling, behandlendeEnhet, fagsystem }: Klagemulighet) =>
    test.step('Velg klagemulighet', async () => {
      const muligheter = this.page.getByRole('table', { name: 'Klagemuligheter' });
      await muligheter.waitFor({ timeout: 20_000 });
      const rows = muligheter.locator('tbody tr');

      const mulighet = rows
        .filter({ has: this.page.locator('td:nth-of-type(1)').filter({ hasText: fagsakId }) })
        .filter({ has: this.page.locator('td:nth-of-type(2)').filter({ hasText: tema }) })
        .filter({ has: this.page.locator('td:nth-of-type(3)').filter({ hasText: vedtakInnstilling }) })
        .filter({ has: this.page.locator('td:nth-of-type(4)').filter({ hasText: behandlendeEnhet }) })
        .filter({ has: this.page.locator('td:nth-of-type(5)').filter({ hasText: fagsystem }) });

      await mulighet.waitFor();

      const button = mulighet.getByRole('button', { name: 'Velg' }).last();

      const id = await button.getAttribute('data-testid');

      if (id === null) {
        throw new Error('Could not find data-testid attribute on td holding select button');
      }

      const requestPromise = this.page.waitForRequest('**/registreringer/**/mulighet');
      await button.click();
      await finishedRequest(requestPromise);

      const selected = muligheter.getByTestId(id);
      await expect(selected).toHaveAttribute('title', 'Valgt');
    });
}
