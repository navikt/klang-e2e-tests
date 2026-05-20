import { checkLoggedIn } from '@app/fixtures/registrering/login';
import type { SharedState } from '@app/fixtures/registrering/shared-state';
import { Type } from '@app/fixtures/registrering/shared-state';
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class KvitteringPage {
  constructor(
    private page: Page,
    private context: BrowserContext,
    private state: SharedState,
  ) {}

  async verify() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      await this.#verifyAuthenticatedKvittering();
    } else {
      await this.#verifyUnauthenticatedInnsending();
    }
  }

  async downloadPdf() {
    const MAX_ATTEMPTS = 3;

    const link = this.page.getByText(this.#pdfLinkText);

    await link.waitFor({ state: 'visible' });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const pagePromise = this.context.waitForEvent('page', { timeout: 10_000 });
        const downloadPromise = this.page.waitForEvent('download', { timeout: 10_000 });

        // Suppress unhandled rejections from the losing promise before racing
        pagePromise.catch(() => undefined);
        downloadPromise.catch(() => undefined);

        await link.click();

        const result = await Promise.race([
          pagePromise.then((page) => ({ type: 'page' as const, page })),
          downloadPromise.then((download) => ({ type: 'download' as const, download })),
        ]);

        if (result.type === 'page') {
          await result.page.waitForLoadState('load', { timeout: 10_000 });
          await result.page.close();
        }

        return;
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`PDF download failed after ${MAX_ATTEMPTS} attempts`);
        }
      }
    }
  }

  async #verifyAuthenticatedKvittering() {
    if (this.state.type === Type.Klage) {
      await expect(this.page.getByText('Kvittering for innsendt klage')).toBeVisible();
    } else if (this.state.type === Type.Anke) {
      await expect(this.page.getByText('Kvittering for innsendt anke')).toBeVisible();
    } else if (this.state.type === Type.Klageettersendelse) {
      await expect(this.page.getByText('Kvittering for ettersendelse til klage')).toBeVisible();
    } else if (this.state.type === Type.Ankeettersendelse) {
      await expect(this.page.getByText('Kvittering for ettersendelse til anke')).toBeVisible();
    }

    await expect(this.page.getByText('Nå er resten vårt ansvar')).toBeVisible();
  }

  async #verifyUnauthenticatedInnsending() {
    if (this.state.type === Type.Klageettersendelse || this.state.type === Type.Ankeettersendelse) {
      await expect(
        this.page.getByText(
          'Skriv ut dokumentasjonen. Ved utskrift kommer en forside som Nav har laget for deg. Denne skal ligge øverst. Følg oppskriften på forsiden.',
        ),
      ).toBeVisible();

      await expect(this.page.getByText('Signer forsiden og siste side i dokumentasjonen.')).toBeVisible();
    } else {
      await expect(
        this.page.getByText(
          `Skriv ut ${this.state.type}n. Ved utskrift kommer en forside som Nav har laget for deg. Denne skal ligge øverst. Følg oppskriften på forsiden.`,
        ),
      ).toBeVisible();

      await expect(this.page.getByText(`Signer forsiden og siste side i ${this.state.type}n.`)).toBeVisible();
    }

    if (this.state.skalSendeMedVedlegg) {
      await expect(this.page.getByText('Legg ved vedleggene.')).toBeVisible();
    }

    await expect(this.page.getByText('Send i posten til')).toBeVisible();
    await expect(this.page.getByText('Nav skanning')).toBeVisible();
    await expect(this.page.getByText('Postboks 1400')).toBeVisible();
    await expect(this.page.getByText('0109 Oslo')).toBeVisible();
  }

  get #pdfLinkText(): string {
    switch (this.state.type) {
      case Type.Klage:
        return 'Se og last ned klagen din';
      case Type.Anke:
        return 'Se og last ned anken din';
      case Type.Klageettersendelse:
      case Type.Ankeettersendelse:
        return 'Se og last ned den ettersendte dokumentasjonen din';
      default:
        throw new Error(`Unknown type: ${this.state.type}`);
    }
  }
}
