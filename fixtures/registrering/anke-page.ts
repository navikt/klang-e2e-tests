import test, { expect, type Page } from '@playwright/test';
import { finishedRequest } from '../helpers';
import type { Ankemulighet } from './types';

export class AnkePage {
  constructor(public readonly page: Page) {}

  selectAnke = async () =>
    test.step('Velg type: anke', async () => {
      await this.page.getByRole('radio', { name: 'Anke', exact: true }).click();

      return this.page.getByText('Velg vedtaket anken gjelder');
    });

  selectMulighet = ({ type, fagsakId, tema, ytelse, vedtaksdato, fagsystem }: Ankemulighet) =>
    test.step('Velg ankemulighet', async () => {
      const muligheter = this.page.getByRole('table', { name: 'Ankemuligheter' });
      await muligheter.waitFor({ timeout: 20_000 });
      const rows = muligheter.locator('tbody tr');

      const mulighet = rows
        .filter({ has: this.page.locator('td:nth-of-type(1)').filter({ hasText: type }) })
        .filter({ has: this.page.locator('td:nth-of-type(2)').filter({ hasText: fagsakId }) })
        .filter({ has: this.page.locator('td:nth-of-type(3)').filter({ hasText: tema }) })
        .filter({ has: this.page.locator('td:nth-of-type(4)').filter({ hasText: ytelse }) })
        .filter({ has: this.page.locator('td:nth-of-type(5)').filter({ hasText: vedtaksdato }) })
        .filter({ has: this.page.locator('td:nth-of-type(6)').filter({ hasText: fagsystem }) });

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
