import test, { type Page } from '@playwright/test';

export class OmgjøringskravPage {
  constructor(public readonly page: Page) {}

  selectOmgjøringskrav = async () =>
    test.step('Velg type: omgjøringskrav', async () => {
      await this.page.getByRole('radio', { name: 'Omgjøringskrav', exact: true }).click();

      return this.page.getByText('Velg vedtaket omgjøringskravet gjelder');
    });
}
