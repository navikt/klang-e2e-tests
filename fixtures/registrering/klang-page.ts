import path from 'node:path';
import { UI_DOMAIN } from '@app/config/env';
import { dismissConsentBanner } from '@app/fixtures/consent';
import { clearIfNotEmpty, finishedRequest, formatId } from '@app/fixtures/helpers';
import type { Innsendingsytelse } from '@app/fixtures/innsendingsytelse';
import { logIn, verifyLogin } from '@app/fixtures/registrering/login-page';
import { testUser } from '@app/testdata/user';
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export enum Type {
  Klage = 'klage',
  Anke = 'anke',
  Klageettersendelse = 'ettersendelse/klage',
  Ankeettersendelse = 'ettersendelse/anke',
}

export class KlangPage {
  #loggedIn = false;

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

  #avslagChecked: boolean | null = null;
  #utbetaltChecked: boolean | null = null;
  #uenigChecked: boolean | null = null;
  #tilbakebetalingChecked: boolean | null = null;

  constructor(
    private page: Page,
    private context: BrowserContext,
  ) {
    this.#ytelse = null;
    this.#type = null;
    dismissConsentBanner(page, context);
  }

  setDeepLinkParams(internalSaksnummer: string, sakSakstype: string, sakFagsystem: string, harMottattBrev: boolean) {
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

    return this.page.goto(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}?${params}`);
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
    this.#loggedIn = true;

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
    await this.page.goto(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}?${params}`);

    await this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/begrunnelse`);
  }

  setLoggedIn(loggedIn: boolean) {
    this.#loggedIn = loggedIn;
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

    const apiUrl = '**/api/klanker/**/usersaksnummer';

    await clearIfNotEmpty(this.page, this.page.getByLabel('Saksnummer (valgfri)'), apiUrl, this.#loggedIn);
    const requestPromise = this.#loggedIn ? this.page.waitForRequest(apiUrl) : null;

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

    if (this.#loggedIn) {
      return this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/oppsummering`);
    }

    return this.page.waitForURL(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}/oppsummering`);
  }

  async downloadPdf() {
    if (this.#loggedIn) {
      return this.downloadLoggedInPdf();
    }

    const downloadPromise = this.page.waitForEvent('download');
    await this.page.getByText('Last ned / skriv ut').click();
    const download = await downloadPromise;

    const name = await download.suggestedFilename();

    if (this.#type === Type.Klage || this.#type === Type.Anke) {
      expect(name).toContain(
        `Nav ${this.#type === Type.Anke || this.#type === Type.Klage ? this.#type : 'ettersendelse'} - `,
      );
    }

    await this.page.waitForURL(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}/innsending`);

    this.verifyHvaGjørDuNå();
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

  async checkAvslagCheckbox(check = true) {
    this.#avslagChecked = check;
    const label = this.page.getByLabel('Jeg har fått avslag på søknaden min');
    const checked = await label.isChecked();

    if (check !== checked) {
      await label.click();
    }
  }

  async checkUtbetaltCheckbox(check = true) {
    this.#utbetaltChecked = check;
    const label = this.page.getByLabel('Jeg har fått for lite utbetalt');
    const checked = await label.isChecked();

    if (check !== checked) {
      await label.click();
    }
  }

  async checkUenigCheckbox(check = true) {
    this.#uenigChecked = check;
    const label = this.page.getByLabel('Jeg er uenig i noe annet i vedtaket mitt');
    const checked = await label.isChecked();

    if (check !== checked) {
      await label.click();
    }
  }

  async checkTilbakebetalingCheckbox(check = true) {
    this.#tilbakebetalingChecked = check;
    const label = this.page.getByLabel('Jeg er uenig i vedtaket om tilbakebetaling');
    const checked = await label.isChecked();

    if (check !== checked) {
      await label.click();
    }
  }

  async insertVedtaksdato(vedtaksdato: string) {
    this.#vedtaksdato = vedtaksdato;

    const label =
      this.#type === Type.Klage || this.#type === Type.Klageettersendelse
        ? 'Vedtaksdato (valgfri)'
        : 'Dato for klagevedtaket fra Nav klageinstans';

    await clearIfNotEmpty(this.page, this.page.getByLabel(label), '**/api/klanker/**/vedtakdate', this.#loggedIn);

    const requestPromise = this.#loggedIn ? this.page.waitForRequest('**/api/klanker/**/vedtakdate') : null;

    await this.page.getByLabel(label).fill(vedtaksdato);
    await this.page.keyboard.press('Tab');

    if (requestPromise !== null) {
      await finishedRequest(requestPromise);
    }
  }

  async insertBegrunnelse(begrunnelse: string) {
    this.#begrunnelse = begrunnelse;

    const apiUrl = '**/api/klanker/**/fritekst';
    const requestPromise = this.#loggedIn ? this.page.waitForRequest(apiUrl) : null;

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

    await clearIfNotEmpty(this.page, this.page.getByLabel(label()), apiUrl, this.#loggedIn);
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

    const legend = this.page.getByRole('group', {
      name: 'Har du mottatt et brev fra Nav klageinstans eller en annen enhet i Nav om at saken din er sendt til Nav klageinstans?',
    });

    const jaChecked = await legend.getByLabel('Ja').isChecked();
    const neiChecked = await legend.getByLabel('Nei').isChecked();

    if (check && !jaChecked) {
      return legend.getByLabel('Ja').check();
    }

    if (!(check || neiChecked)) {
      return legend.getByLabel('Nei').check();
    }
  }

  verifyMottattBrev() {
    const legend = this.page.getByRole('group', {
      name: 'Har du mottatt et brev fra Nav klageinstans eller en annen enhet i Nav om at saken din er sendt til Nav klageinstans?',
    });

    if (this.#harMottattBrev) {
      expect(legend.getByLabel('Ja')).toBeChecked();
    } else if (this.#harMottattBrev === false) {
      expect(legend.getByLabel('Nei')).toBeChecked();
    } else {
      expect(legend.getByLabel('Ja')).not.toBeChecked();
      expect(legend.getByLabel('Nei')).not.toBeChecked();
    }
  }

  async verifyOppsummering() {
    if (this.#loggedIn) {
      const personopplysninger = this.page.getByRole('heading', { name: 'Personopplysninger' });
      const section = this.page.locator('section').filter({ has: personopplysninger });

      await expect(section.getByText(formatId(testUser.id))).toBeVisible();
      await expect(section.getByText(testUser.firstName)).toBeVisible();
      await expect(section.getByText(testUser.lastName)).toBeVisible();
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

    if (this.#uenigChecked) {
      await expect(this.page.getByText('Jeg er uenig i noe annet i vedtaket mitt')).toBeVisible();
    }

    if (this.#avslagChecked) {
      await expect(this.page.getByText('Jeg har fått avslag på søknaden min')).toBeVisible();
    }

    if (this.#utbetaltChecked) {
      await expect(this.page.getByText('Jeg har fått for lite utbetalt')).toBeVisible();
    }

    if (this.#tilbakebetalingChecked) {
      await expect(this.page.getByText('Jeg er uenig i vedtaket om tilbakebetaling')).toBeVisible();
    }

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
      await section.waitFor();

      expect(section.getByText(this.#internalSaksnummer)).toBeVisible();
    } else {
      expect(await this.page.getByLabel('Saksnummer (valgfri)').inputValue()).toBe(this.#userSaksnummer);
    }
  }

  async verifyBegrunnelse() {
    await this.page.reload();

    if (!this.#loggedIn) {
      expect(await this.page.getByLabel('Fødselsnummer, D-nummer eller NPID').inputValue()).toBe(this.#idNumber);
      expect(await this.page.getByLabel('For- og mellomnavn').inputValue()).toBe(this.#firstName);
      expect(await this.page.getByLabel('Etternavn').inputValue()).toBe(this.#lastName);

      if (this.#skalSendeMedVedlegg) {
        expect(this.page.getByRole('checkbox', { name: 'Jeg skal sende med vedlegg.' })).toBeChecked();
      } else {
        expect(this.page.getByRole('checkbox', { name: 'Jeg skal sende med vedlegg.' })).not.toBeChecked();
      }
    }

    await this.verifySaksnummer();

    if (this.#type === Type.Klage || this.#type === Type.Klageettersendelse) {
      expect(await this.page.getByLabel('Vedtaksdato (valgfri)').inputValue()).toBe(this.#vedtaksdato);
    } else if (this.#type === Type.Anke) {
      expect(await this.page.getByLabel('Dato for klagevedtaket fra Nav klageinstans').inputValue()).toBe(
        this.#vedtaksdato,
      );
    }

    if (this.#type === Type.Klageettersendelse) {
      const fieldset = this.page.locator('fieldset').filter({
        hasText:
          'Har du mottatt et brev fra Nav klageinstans eller en annen enhet i Nav om at saken din er sendt til Nav klageinstans?',
      });

      await fieldset.waitFor();

      if (this.#harMottattBrev === null) {
        expect(fieldset.getByText('Ja')).not.toBeChecked();
        expect(fieldset.getByText('Nei')).not.toBeChecked();
      } else {
        expect(fieldset.getByText(this.#harMottattBrev ? 'Ja' : 'Nei')).toBeChecked();
      }
    }

    if (this.#type === Type.Klage) {
      expect(await this.page.getByLabel('Hvorfor er du uenig?').inputValue()).toBe(this.#begrunnelse);
    } else if (this.#type === Type.Anke) {
      expect(await this.page.getByLabel('Hvorfor er du uenig i klagevedtaket?').inputValue()).toBe(this.#begrunnelse);
    } else if (this.#type === Type.Klageettersendelse || this.#type === Type.Ankeettersendelse) {
      expect(await this.page.getByLabel('Har du noe å legge til?').inputValue()).toBe(this.#begrunnelse);
    }

    if (this.#uenigChecked) {
      expect(this.page.getByLabel('Jeg er uenig i noe annet i vedtaket mitt')).toBeChecked();
    } else if (this.#uenigChecked === false) {
      expect(this.page.getByLabel('Jeg er uenig i noe annet i vedtaket mitt')).not.toBeChecked();
    }

    if (this.#avslagChecked) {
      expect(this.page.getByLabel('Jeg har fått avslag på søknaden min')).toBeChecked();
    } else if (this.#uenigChecked === false) {
      expect(this.page.getByLabel('Jeg har fått avslag på søknaden min')).not.toBeChecked();
    }

    if (this.#utbetaltChecked) {
      expect(this.page.getByLabel('Jeg har fått for lite utbetalt')).toBeChecked();
    } else if (this.#uenigChecked === false) {
      expect(this.page.getByLabel('Jeg har fått for lite utbetalt')).not.toBeChecked();
    }

    if (this.#tilbakebetalingChecked) {
      expect(this.page.getByLabel('Jeg er uenig i vedtaket om tilbakebetaling')).toBeChecked();
    } else if (this.#uenigChecked === false) {
      expect(this.page.getByLabel('Jeg er uenig i vedtaket om tilbakebetaling')).not.toBeChecked();
    }

    if (this.#hasUploadedAttachments) {
      expect(this.page.getByText('Vedlegg (3)')).toBeVisible;
      expect(this.page.getByText('dummy.pdf')).toBeVisible;
      expect(this.page.getByText('logo.png')).toBeVisible;
      expect(this.page.getByText('logo.jpg')).toBeVisible;
    }
  }

  async uploadAttachments() {
    await this.deleteAllVedlegg();

    await this.page
      .locator('[id="file-upload-input"]')
      .setInputFiles([
        path.join(__dirname, '..', '..', 'testdata', 'dummy.pdf'),
        path.join(__dirname, '..', '..', 'testdata', 'logo.png'),
        path.join(__dirname, '..', '..', 'testdata', 'logo.jpg'),
      ]);

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
    await this.page.waitForURL('https://login.microsoftonline.com/**');
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

  private async downloadLoggedInPdf() {
    const pagePromise = this.context.waitForEvent('page', { timeout: 10000 });

    if (this.#type === Type.Klage) {
      await this.page.getByText('Se og last ned klagen din').click();
    } else if (this.#type === Type.Anke) {
      await this.page.getByText('Se og last ned anken din').click();
    } else if (this.#type === Type.Klageettersendelse || this.#type === Type.Ankeettersendelse) {
      await this.page.getByText('Se og last ned den ettersendte dokumentasjonen din').click();
    }

    await pagePromise;
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

  logIn = (path?: string) => logIn(this.page, testUser.id, path);

  async verifyLogin() {
    await verifyLogin(this.page, testUser);
    this.#loggedIn = true;
  }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const REGISTRERING = `http(?:s?)://(?:.+)/sak/(${UUID})`;
export const SAK_REGEX = new RegExp(`${REGISTRERING}`);

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
