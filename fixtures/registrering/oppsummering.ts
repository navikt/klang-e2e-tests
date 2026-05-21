import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import { formatId } from '@/fixtures/helpers';
import { checkLoggedIn } from '@/fixtures/registrering/login';
import type { SharedState } from '@/fixtures/registrering/shared-state';
import { Type } from '@/fixtures/registrering/shared-state';
import { TEST_USER } from '@/testdata/user';

export class OppsummeringPage {
  constructor(
    private page: Page,
    private state: SharedState,
  ) {}

  async verify() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      const personopplysninger = this.page.getByRole('heading', { name: 'Personopplysninger' });
      const section = this.page.locator('section').filter({ has: personopplysninger });

      await expect(section.getByText(formatId(TEST_USER.id))).toBeVisible();
      await expect(section.getByText(TEST_USER.firstName)).toBeVisible();
      await expect(section.getByText(TEST_USER.lastName)).toBeVisible();
    } else {
      await expect(this.page.getByText(formatId(this.state.idNumber))).toBeVisible();
      await expect(this.page.getByText(this.state.firstName)).toBeVisible();
      await expect(this.page.getByText(this.state.lastName)).toBeVisible();
    }

    if (this.state.internalSaksnummer !== null) {
      await expect(this.page.getByText(this.state.internalSaksnummer)).toBeVisible();
    } else {
      await expect(this.page.getByText(this.state.userSaksnummer)).toBeVisible();
    }

    await expect(this.page.getByText(this.state.vedtaksdato)).toBeVisible();
    await expect(this.page.getByText(this.state.begrunnelse)).toBeVisible();

    if (this.state.hasUploadedAttachments) {
      await expect(this.page.getByText('Vedlagte dokumenter (3)')).toBeVisible();
      await expect(this.page.getByText('dummy.pdf')).toBeVisible();
      await expect(this.page.getByText('logo.png')).toBeVisible();
      await expect(this.page.getByText('logo.jpg')).toBeVisible();
    } else if (!isLoggedIn) {
      const vedleggSection = this.page.locator('section').filter({
        has: this.page.getByRole('heading', { name: 'Vedlagte dokumenter' }),
      });
      await expect(vedleggSection.getByText(this.state.skalSendeMedVedlegg ? 'Ja' : 'Nei')).toBeVisible();
    }
  }

  checkJegForstårCheckbox() {
    if (this.state.type === Type.Klage) {
      return this.page.getByLabel('Jeg forstår at jeg selv må skrive ut og sende klagen i posten selv.').check();
    }

    if (this.state.type === Type.Anke) {
      return this.page.getByLabel('Jeg forstår at jeg selv må skrive ut og sende anken i posten selv.').check();
    }

    return this.page.getByLabel('Jeg forstår at jeg selv må skrive ut og sende ettersendelsen i posten selv.').check();
  }

  async sendInn() {
    await this.page.getByText('Send inn').click();
    await this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/kvittering`);
  }

  async download() {
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const downloadPromise = this.page.waitForEvent('download', { timeout: 10_000 });
        await this.page.getByText('Last ned / skriv ut').click();
        const download = await downloadPromise;

        const name = download.suggestedFilename();

        if (this.state.type === Type.Klage || this.state.type === Type.Anke) {
          expect(name).toContain(`Nav ${this.state.type} - `);
        }

        await this.page.waitForURL(`${UI_DOMAIN}/nb/${this.state.type}/${this.state.ytelse}/innsending`);

        return;
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`Download failed after ${MAX_ATTEMPTS} attempts`);
        }
      }
    }
  }
}
