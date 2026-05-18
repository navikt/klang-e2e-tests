import path from 'node:path';
import { UI_DOMAIN } from '@app/config/env';
import { dismissConsentBanner } from '@app/fixtures/consent';
import { clearIfNotEmpty, finishedRequest, formatId } from '@app/fixtures/helpers';
import type { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { checkLoggedIn, logIn } from '@app/fixtures/registrering/login';
import { TEST_USER } from '@app/testdata/user';
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export enum Type {
  Klage = 'klage',
  Anke = 'anke',
  Klageettersendelse = 'ettersendelse/klage',
  Ankeettersendelse = 'ettersendelse/anke',
}

export class KlangPage {
  #ytelse: Innsendingsytelse | null;
  #type: Type | null;

  #idNumber = '';
  #firstName = '';
  #lastName = '';
  #vedtaksdato = '';
  #userSaksnummer = '';
  #begrunnelse = '';
  #skalSendeMedVedlegg = false;
  #hasUploadedAttachments = false;

  #internalSaksnummer: string | null = null;
  #sakFagsystem: string | null = null;
  #sakSakstype: string | null = null;
  #harMottattBrev: boolean | null = null;

  constructor(
    private page: Page,
    private context: BrowserContext,
  ) {
    this.#ytelse = null;
    this.#type = null;
    dismissConsentBanner(page, context);
  }

  async setDeepLinkParams(
    internalSaksnummer: string,
    sakSakstype: string,
    sakFagsystem: string,
    harMottattBrev: boolean,
  ) {
    this.#internalSaksnummer = internalSaksnummer;
    this.#sakSakstype = sakSakstype;
    this.#sakFagsystem = sakFagsystem;
    this.#harMottattBrev = harMottattBrev;

    const params = toQueryParams({
      saksnummer: internalSaksnummer,
      sakstype: sakSakstype,
      fagsystem: sakFagsystem,
      ka: harMottattBrev,
    });

    if (SAK_REGEX.test(this.page.url())) {
      // Logged in with an active case — delete it first, then navigate.
      // The app won't create a new case if one already exists.
      await this.deleteCase();
      await this.#navigateAndWaitForBegrunnelse(
        `${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}?${params}`,
        `${UI_DOMAIN}/nb/sak/**/begrunnelse`,
      );
    } else {
      // Not logged in — navigate and wait for client-side redirect to /begrunnelse.
      await this.#navigateAndWaitForBegrunnelse(
        `${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}?${params}`,
        `${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}/begrunnelse`,
      );
    }
  }

  async createCase(
    type: Type,
    ytelse: Innsendingsytelse,
    saksnummer: string | null = null,
    sakSakstype: string | null = null,
    sakFagsystem: string | null = null,
    ka: boolean | null = null,
  ) {
    this.#ytelse = ytelse;
    this.#type = type;
    this.#internalSaksnummer = saksnummer;
    this.#sakFagsystem = sakFagsystem;
    this.#sakSakstype = sakSakstype;
    this.#harMottattBrev = ka;

    const params = toQueryParams({ saksnummer, sakstype: sakSakstype, fagsystem: sakFagsystem, ka: ka });

    await this.page.goto(`${UI_DOMAIN}/nb/${type}/${this.#ytelse}?${params}`);
    await this.page.waitForURL(`${UI_DOMAIN}/nb/${type}/${this.#ytelse}/begrunnelse`);
  }

  async createLoggedInCase(
    type: Type,
    ytelse: Innsendingsytelse,
    saksnummer: string | null = null,
    sakSakstype: string | null = null,
    sakFagsystem: string | null = null,
    harMottattBrev: boolean | null = null,
  ) {
    this.#type = type;
    this.#ytelse = ytelse;
    this.#internalSaksnummer = saksnummer;
    this.#sakFagsystem = sakFagsystem;
    this.#sakSakstype = sakSakstype;
    this.#harMottattBrev = harMottattBrev;

    await this.#ensureNewLoggedInCase();
  }

  // We want to avoid resuming an old case with unknown data, so we create/resume, delete, and create again for a guaranteed fresh one
  async #ensureNewLoggedInCase() {
    const params = toQueryParams({
      saksnummer: this.#internalSaksnummer,
      sakstype: this.#sakSakstype,
      fagsystem: this.#sakFagsystem,
      ka: this.#harMottattBrev,
    });

    await this.#createLoggedInCase(params);
    await this.deleteCase();
    await this.#createLoggedInCase(params);
  }

  async #createLoggedInCase(params: string) {
    await this.#navigateAndWaitForBegrunnelse(
      `${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}?${params}`,
      `${UI_DOMAIN}/nb/sak/**/begrunnelse`,
    );
  }

  /**
   * Navigate to a URL and wait for the app to redirect to /begrunnelse.
   * Retries the navigation if the redirect doesn't happen (dev server may fail to serve JS bundle under load).
   */
  async #navigateAndWaitForBegrunnelse(gotoUrl: string, expectedUrlPattern: string) {
    const MAX_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.page.goto(gotoUrl, { waitUntil: 'commit' });

      try {
        await this.page.waitForURL(expectedUrlPattern, { timeout: 15_000 });
        await this.page.locator('main').waitFor({ timeout: 5_000 });
        return;
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `Navigation to ${expectedUrlPattern} failed after ${MAX_ATTEMPTS} attempts. ` +
              `Current URL: ${this.page.url()}`,
          );
        }
      }
    }
  }

  insertIdNumber(idNumber: string) {
    this.#idNumber = idNumber;
    return this.page.getByLabel('Fødselsnummer, D-nummer eller NPID').fill(idNumber);
  }

  insertFirstName(firstName: string) {
    this.#firstName = firstName;
    return this.page.getByLabel('For- og mellomnavn').fill(firstName);
  }

  insertLastName(lastName: string) {
    this.#lastName = lastName;
    return this.page.getByLabel('Etternavn').fill(lastName);
  }

  async insertSaksnummer(saksnummer: string) {
    this.#userSaksnummer = saksnummer;

    const isLoggedIn = await checkLoggedIn(this.page);

    const apiUrl = '**/api/klanker/**/usersaksnummer';

    await clearIfNotEmpty(this.page, this.page.getByLabel('Saksnummer (valgfri)'), apiUrl, isLoggedIn);
    const requestPromise = isLoggedIn ? this.page.waitForRequest(apiUrl) : null;

    await this.page.getByLabel('Saksnummer (valgfri)').fill(saksnummer);
    await this.page.keyboard.press('Tab');

    if (requestPromise !== null) {
      await finishedRequest(requestPromise);
    }
  }

  checkVedleggCheckbox(check = true) {
    this.#skalSendeMedVedlegg = check;
    const checkbox = this.page.getByRole('checkbox', { name: 'Jeg skal sende med vedlegg.' });

    return check ? checkbox.check() : checkbox.uncheck();
  }

  async goToOppsummering() {
    await this.page.getByText('Gå videre').click();

    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      return this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/oppsummering`);
    }

    return this.page.waitForURL(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}/oppsummering`);
  }

  async downloadPdf() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      return this.downloadLoggedInPdf();
    }

    const download = await this.#waitForDownload();

    const name = download.suggestedFilename();

    if (this.#type === Type.Klage || this.#type === Type.Anke) {
      expect(name).toContain(
        `Nav ${this.#type === Type.Anke || this.#type === Type.Klage ? this.#type : 'ettersendelse'} - `,
      );
    }

    await this.page.waitForURL(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}/innsending`);

    this.verifyHvaGjørDuNå();
  }

  async #waitForDownload() {
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const downloadPromise = this.page.waitForEvent('download', { timeout: 15_000 });
        await this.page.getByText('Last ned / skriv ut').click();
        return await downloadPromise;
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`Download failed after ${MAX_ATTEMPTS} attempts`);
        }
      }
    }

    throw new Error('Download failed');
  }

  verifyHvaGjørDuNå() {
    if (this.#type === Type.Klageettersendelse || this.#type === Type.Ankeettersendelse) {
      expect(
        this.page.getByText(
          'Skriv ut dokumentasjonen. Ved utskrift kommer en forside som Nav har laget for deg. Denne skal ligge øverst. Følg oppskriften på forsiden.',
        ),
      ).toBeVisible();

      expect(this.page.getByText('Signer forsiden og siste side i dokumentasjonen.')).toBeVisible();
    } else {
      expect(
        this.page.getByText(
          `Skriv ut ${this.#type}n. Ved utskrift kommer en forside som Nav har laget for deg. Denne skal ligge øverst. Følg oppskriften på forsiden.`,
        ),
      ).toBeVisible();

      expect(this.page.getByText(`Signer forsiden og siste side i ${this.#type}n.`)).toBeVisible();
    }
    expect(this.page.getByText('Send i posten til')).toBeVisible();
    expect(this.page.getByText('Nav skanning')).toBeVisible();
    expect(this.page.getByText('Postboks 1400')).toBeVisible();
    expect(this.page.getByText('0109 Oslo')).toBeVisible();
  }

  async insertVedtaksdato(vedtaksdato: string) {
    this.#vedtaksdato = vedtaksdato;

    const label =
      this.#type === Type.Klage || this.#type === Type.Klageettersendelse
        ? 'Vedtaksdato (valgfri)'
        : 'Dato for klagevedtaket fra Klageinstans';

    const isLoggedIn = await checkLoggedIn(this.page);

    await clearIfNotEmpty(this.page, this.page.getByLabel(label), '**/api/klanker/**/vedtakdate', isLoggedIn);

    const requestPromise = isLoggedIn ? this.page.waitForRequest('**/api/klanker/**/vedtakdate') : null;

    await this.page.getByLabel(label).fill(vedtaksdato);
    await this.page.keyboard.press('Tab');

    if (requestPromise !== null) {
      await finishedRequest(requestPromise);
    }
  }

  async insertBegrunnelse(begrunnelse: string) {
    this.#begrunnelse = begrunnelse;

    const isLoggedIn = await checkLoggedIn(this.page);

    const apiUrl = '**/api/klanker/**/fritekst';
    const requestPromise = isLoggedIn ? this.page.waitForRequest(apiUrl) : null;

    const label = () => {
      switch (this.#type) {
        case Type.Klage:
          return 'Hvorfor er du uenig?';
        case Type.Anke:
          return 'Hvorfor er du uenig i klagevedtaket?';
        case Type.Klageettersendelse:
        case Type.Ankeettersendelse:
          return 'Har du noe å legge til?';
        default:
          throw new Error(`Unknown type: ${this.#type}`);
      }
    };

    await clearIfNotEmpty(this.page, this.page.getByLabel(label()), apiUrl, isLoggedIn);
    await this.page.getByLabel(label()).fill(begrunnelse);
    await this.page.keyboard.press('Tab');

    if (requestPromise !== null) {
      await finishedRequest(requestPromise);
    }
  }

  checkJegForstårCheckbox() {
    if (this.#type === Type.Klage) {
      return this.page.getByLabel('Jeg forstår at jeg selv må skrive ut og sende klagen i posten selv.').check();
    }

    if (this.#type === Type.Anke) {
      return this.page.getByLabel('Jeg forstår at jeg selv må skrive ut og sende anken i posten selv.').check();
    }

    return this.page.getByLabel('Jeg forstår at jeg selv må skrive ut og sende ettersendelsen i posten selv.').check();
  }

  async checkHarMottattBrevCheckbox(check = true) {
    this.#harMottattBrev = check;

    const legend = this.page.getByRole('radiogroup', {
      name: 'Har du mottatt et brev fra Klageinstans eller en annen enhet i Nav om at saken din er sendt til Klageinstans?',
    });

    if (check) {
      await legend.getByLabel('Ja').click();
    } else {
      await legend.getByLabel('Nei').click();
    }
  }

  async verifyMottattBrev() {
    const legend = this.page.getByRole('radiogroup', {
      name: 'Har du mottatt et brev fra Klageinstans eller en annen enhet i Nav om at saken din er sendt til Klageinstans?',
    });

    if (this.#harMottattBrev) {
      await expect(legend.getByLabel('Ja')).toBeChecked();
    } else if (this.#harMottattBrev === false) {
      await expect(legend.getByLabel('Nei')).toBeChecked();
    } else {
      await expect(legend.getByLabel('Ja')).not.toBeChecked();
      await expect(legend.getByLabel('Nei')).not.toBeChecked();
    }
  }

  async verifyOppsummering() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      const personopplysninger = this.page.getByRole('heading', { name: 'Personopplysninger' });
      const section = this.page.locator('section').filter({ has: personopplysninger });

      await expect(section.getByText(formatId(TEST_USER.id))).toBeVisible();
      await expect(section.getByText(TEST_USER.firstName)).toBeVisible();
      await expect(section.getByText(TEST_USER.lastName)).toBeVisible();
    } else {
      await expect(this.page.getByText(formatId(this.#idNumber))).toBeVisible();
      await expect(this.page.getByText(this.#firstName)).toBeVisible();
      await expect(this.page.getByText(this.#lastName)).toBeVisible();
    }

    if (this.#internalSaksnummer !== null) {
      await expect(this.page.getByText(this.#internalSaksnummer)).toBeVisible();
    } else {
      await expect(this.page.getByText(this.#userSaksnummer)).toBeVisible();
    }

    await expect(this.page.getByText(this.#vedtaksdato)).toBeVisible();
    await expect(this.page.getByText(this.#begrunnelse)).toBeVisible();

    if (this.#hasUploadedAttachments) {
      expect(this.page.getByText('Vedlagde dokumenter (3)')).toBeVisible;
      expect(this.page.getByText('dummy.pdf')).toBeVisible;
      expect(this.page.getByText('logo.png')).toBeVisible;
      expect(this.page.getByText('logo.jpg')).toBeVisible;
    }
  }

  async verifySaksnummer() {
    if (this.#internalSaksnummer !== null) {
      const section = this.page.locator('section').filter({ hasText: 'Saksnummer' });

      await expect(section.getByText(this.#internalSaksnummer)).toBeVisible({ timeout: 10_000 });
    } else {
      expect(await this.page.getByLabel('Saksnummer (valgfri)').inputValue()).toBe(this.#userSaksnummer);
    }
  }

  async verifyBegrunnelse() {
    await this.verifyPersonalInfo();

    await this.verifySaksnummer();

    if (this.#type === Type.Klage || this.#type === Type.Klageettersendelse) {
      expect(await this.page.getByLabel('Vedtaksdato (valgfri)').inputValue()).toBe(this.#vedtaksdato);
    } else if (this.#type === Type.Anke) {
      expect(await this.page.getByLabel('Dato for klagevedtaket fra Klageinstans').inputValue()).toBe(
        this.#vedtaksdato,
      );
    }

    if (this.#type === Type.Klageettersendelse) {
      const fieldset = this.page.locator('fieldset').filter({
        hasText:
          'Har du mottatt et brev fra Klageinstans eller en annen enhet i Nav om at saken din er sendt til Klageinstans?',
      });

      await fieldset.waitFor();

      if (this.#harMottattBrev === null) {
        await expect(fieldset.getByLabel('Ja')).not.toBeChecked();
        await expect(fieldset.getByLabel('Nei')).not.toBeChecked();
      } else {
        await expect(fieldset.getByLabel(this.#harMottattBrev ? 'Ja' : 'Nei')).toBeChecked();
      }
    }

    if (this.#type === Type.Klage) {
      expect(await this.page.getByLabel('Hvorfor er du uenig?').inputValue()).toBe(this.#begrunnelse);
    } else if (this.#type === Type.Anke) {
      expect(await this.page.getByLabel('Hvorfor er du uenig i klagevedtaket?').inputValue()).toBe(this.#begrunnelse);
    } else if (this.#type === Type.Klageettersendelse || this.#type === Type.Ankeettersendelse) {
      expect(await this.page.getByLabel('Har du noe å legge til?').inputValue()).toBe(this.#begrunnelse);
    }

    const isLoggedIn = await checkLoggedIn(this.page);

    if (!isLoggedIn) {
      const vedleggCheckbox = this.page.getByRole('checkbox', { name: 'Jeg skal sende med vedlegg.' });

      if (this.#skalSendeMedVedlegg) {
        await expect(vedleggCheckbox).toBeChecked();
      } else {
        await expect(vedleggCheckbox).not.toBeChecked();
      }
    }

    if (this.#hasUploadedAttachments) {
      await this.verifyAttachments();
    }
  }

  async uploadAttachments() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (!isLoggedIn) {
      throw new Error(
        'uploadAttachments() can only be used when logged in. Use checkVedleggCheckbox() for unauthenticated cases.',
      );
    }

    await this.deleteAllVedlegg();

    await this.page
      .locator('[id="file-upload-input"]')
      .setInputFiles([
        path.join(__dirname, '..', '..', 'testdata', 'dummy.pdf'),
        path.join(__dirname, '..', '..', 'testdata', 'logo.png'),
        path.join(__dirname, '..', '..', 'testdata', 'logo.jpg'),
      ]);

    // Wait for all uploads to complete
    await this.verifyAttachments();
  }

  async verifyAttachments() {
    await expect(this.page.getByText('Vedlegg (3)')).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText('dummy.pdf')).toBeVisible();
    await expect(this.page.getByText('logo.png')).toBeVisible();
    await expect(this.page.getByText('logo.jpg')).toBeVisible();

    this.#hasUploadedAttachments = true;
  }

  async deleteCase() {
    const urlMatch = this.page.url().match(SAK_REGEX);

    if (urlMatch === null) {
      throw new Error('Could not find case UUID');
    }

    const [_, uuid] = urlMatch;

    const requestPromise = this.page.waitForRequest(
      (request) => request.url().endsWith(`/klanker/${uuid}`) && request.method() === 'DELETE',
    );

    if (this.#type === Type.Klage) {
      await this.page.getByTitle('Slett klagen og returner til hovedsiden').click();
    } else if (this.#type === Type.Anke) {
      await this.page.getByTitle('Slett anken og returner til hovedsiden').click();
    } else if (this.#type === Type.Klageettersendelse || this.#type === Type.Ankeettersendelse) {
      await this.page.getByTitle('Slett ettersendelsen og returner til hovedsiden').click();
    }

    await this.page.getByTitle('Bekreft sletting').click();
    await finishedRequest(requestPromise);
    await this.page.waitForURL('https://login.microsoftonline.com/**', { timeout: 30_000 });
  }

  async sendInn() {
    await this.page.getByText('Send inn').click();
    await this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/kvittering`);

    if (this.#type === Type.Klage) {
      expect(this.page.getByText('Kvittering for innsendt klage')).toBeVisible();
    } else if (this.#type === Type.Anke) {
      expect(this.page.getByText('Kvittering for innsendt anke')).toBeVisible();
    } else if (this.#type === Type.Klageettersendelse) {
      expect(this.page.getByText('Kvittering for ettersendelse til klage')).toBeVisible();
    } else if (this.#type === Type.Ankeettersendelse) {
      expect(this.page.getByText('Kvittering for ettersendelse til anke')).toBeVisible();
    }

    expect(this.page.getByText('Nå er resten vårt ansvar')).toBeVisible();
  }

  private get pdfLinkText(): string {
    switch (this.#type) {
      case Type.Klage:
        return 'Se og last ned klagen din';
      case Type.Anke:
        return 'Se og last ned anken din';
      case Type.Klageettersendelse:
      case Type.Ankeettersendelse:
        return 'Se og last ned den ettersendte dokumentasjonen din';
    }

    throw new Error(`Unknown type: ${this.#type}`);
  }

  private async downloadLoggedInPdf() {
    const MAX_ATTEMPTS = 3;

    const link = this.page.getByText(this.pdfLinkText);

    // Wait for the link to appear — PDF generation may be async
    await link.waitFor({ state: 'visible', timeout: 15_000 });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // The PDF endpoint may either open in a new tab or trigger a download,
        // depending on server response headers. Listen for both events.
        const pagePromise = this.context.waitForEvent('page', { timeout: 10_000 });
        const downloadPromise = this.page.waitForEvent('download', { timeout: 10_000 });

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
          throw new Error(`Logged-in PDF download failed after ${MAX_ATTEMPTS} attempts`);
        }
      }
    }
  }

  async deleteAllVedlegg() {
    await this.page.getByText(/Vedlegg.*/, { exact: true }).waitFor();

    const items = await this.page
      .locator('li')
      .filter({ has: this.page.getByTitle(/Slett.*/, { exact: true }) })
      .all();

    for (const li of items.reverse()) {
      const requestPromise = this.page.waitForRequest('**/api/klanker/**/vedlegg/**');
      await li.locator('button').click();
      await finishedRequest(requestPromise);
    }
  }

  async logIn() {
    await logIn(this.page, TEST_USER.id);

    // After login, create a fresh case. Use the same create→delete→create pattern
    // as #ensureNewLoggedInCase to handle stale backend state (e.g. leftover case
    // from global-setup or previous test runs).
    const params = toQueryParams({
      saksnummer: this.#internalSaksnummer,
      sakstype: this.#sakSakstype,
      fagsystem: this.#sakFagsystem,
      ka: this.#harMottattBrev,
    });

    await this.#createLoggedInCase(params);
    await this.deleteCase();
    await this.#createLoggedInCase(params);

    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      this.#idNumber = TEST_USER.id;
      this.#firstName = TEST_USER.firstName;
      this.#lastName = TEST_USER.lastName;
    }

    await this.verifyPersonalInfo();
  }

  async verifyPersonalInfo() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      const firstNameSection = this.getSectionByHeading('For- og mellomnavn');
      await firstNameSection.waitFor({ timeout: 15_000 });
      const lastNameSection = this.getSectionByHeading('Etternavn');
      const idNumberSection = this.getSectionByHeading('Fødselsnummer, D-nummer eller NPID');

      await expect(firstNameSection).toContainText(this.#firstName);
      await expect(lastNameSection).toContainText(this.#lastName);
      await expect(idNumberSection).toContainText(formatId(this.#idNumber));
    } else {
      await expect(this.page.getByLabel('Fødselsnummer, D-nummer eller NPID')).toBeVisible();
      expect(await this.page.getByLabel('Fødselsnummer, D-nummer eller NPID').inputValue()).toBe(this.#idNumber);
      expect(await this.page.getByLabel('For- og mellomnavn').inputValue()).toBe(this.#firstName);
      expect(await this.page.getByLabel('Etternavn').inputValue()).toBe(this.#lastName);
    }
  }

  private getSectionByHeading = (heading: string) =>
    this.page.locator('section', { has: this.page.getByRole('heading', { name: heading }) });
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
export const SAK_REGEX = new RegExp(`http(?:s?)://(?:.+)/sak/(${UUID.source})`);

interface DeepLink {
  saksnummer: string | null;
  sakstype: string | null;
  fagsystem: string | null;
  ka: boolean | null;
}

const toQueryParams = (params: DeepLink) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== '') {
      query.append(key, value);
    }
  }

  return query.toString();
};
