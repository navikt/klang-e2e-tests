import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { getCasePdfPath, Language, openCaseFileInNewTab, verifyCaseFileLink } from '@/fixtures/case-files';
import { checkLoggedIn } from '@/fixtures/registrering/login';
import type { SharedState } from '@/fixtures/registrering/shared-state';
import { LOGGED_IN_SAK_REGEX, Type } from '@/fixtures/registrering/shared-state';

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

  /** Opens the case PDF from the logged in kvittering. It is served inline in a new tab by the server route. */
  async downloadPdf() {
    const MAX_ATTEMPTS = 3;

    const link = this.page.getByRole('link', { name: this.#pdfLinkText });

    await link.waitFor({ state: 'visible', timeout: 25_000 });
    await verifyCaseFileLink(link, getCasePdfPath(Language.NB, this.#getCaseId()));

    // The journalført PDF may not be available right away.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await openCaseFileInNewTab(this.page, this.context, link);

        return;
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`Opening the PDF failed after ${MAX_ATTEMPTS} attempts`, { cause: error });
        }
      }
    }
  }

  #getCaseId(): string {
    const urlMatch = this.page.url().match(LOGGED_IN_SAK_REGEX);

    if (urlMatch === null) {
      throw new Error(`Expected to be on a logged-in case, but URL is ${this.page.url()}`);
    }

    const [, caseId] = urlMatch;

    return caseId;
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
