import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { UI_DOMAIN } from '../../config/env';
import { testUser } from '../../testdata/user';
import { clearIfNotEmpty, finishedRequest, formatId } from '../helpers';
import type { Innsendingsytelse } from '../innsendingsytelse';
import { logIn, verifyLogin } from './login-page';
type Type = 'klage' | 'anke' | 'klageettersendelse' | 'ankeettersendelse';

export class KlangPage {
  #loggedIn = false;

  #ytelse: Innsendingsytelse | null;
  #type: Type | null;

  #idNumber = '';
  #firstName = '';
  #lastName = '';
  #saksnummer = '';
  #vedtaksdato = '';
  #begrunnelse = '';
  #skalSendeMedVedlegg = false;
  #hasUploadedAttachments = false;

  #avslagChecked: boolean | null = null;
  #utbetaltChecked: boolean | null = null;
  #uenigChecked: boolean | null = null;
  #tilbakebetalingChecked: boolean | null = null;

  #harMottattBrev: boolean | null = null;

  constructor(
    private page: Page,
    private context: BrowserContext,
  ) {
    this.#ytelse = null;
    this.#type = null;
  }

  async createCase(type: Type, ytelse: Innsendingsytelse, saksnummer = '') {
    this.#ytelse = ytelse;
    this.#type = type;
    this.#saksnummer = saksnummer;

    const saksnummerParam = saksnummer.length > 0 ? `?saksnummer=${saksnummer}` : '';

    if (type === 'klageettersendelse') {
      await this.page.goto(`${UI_DOMAIN}/nb/ettersendelse/klage/${this.#ytelse}${saksnummerParam}`);
      await this.page.waitForURL(`${UI_DOMAIN}/nb/ettersendelse/klage/${this.#ytelse}/begrunnelse`);

      return;
    }

    if (type === 'ankeettersendelse') {
      await this.page.goto(`${UI_DOMAIN}/nb/ettersendelse/anke/${this.#ytelse}${saksnummerParam}`);
      await this.page.waitForURL(`${UI_DOMAIN}/nb/ettersendelse/anke/${this.#ytelse}/begrunnelse`);

      return;
    }

    await this.page.goto(`${UI_DOMAIN}/nb/${type}/${this.#ytelse}${saksnummerParam}`);
    await this.page.waitForURL(`${UI_DOMAIN}/nb/${type}/${this.#ytelse}/begrunnelse`);
  }

  async createLoggedInCase(type: Type, ytelse: Innsendingsytelse, saksnummer = '', ka: boolean | null = null) {
    this.#type = type;
    this.#ytelse = ytelse;
    this.#saksnummer = saksnummer;
    this.#harMottattBrev = ka;
    this.#loggedIn = true;

    await this.#ensureNewLoggedInCase();
  }

  async #ensureNewLoggedInCase() {
    const saksnummerParam = this.#saksnummer.length > 0 ? `saksnummer=${this.#saksnummer}&` : '';
    const kaParam = this.#harMottattBrev === true ? 'ka=true' : '';
    const params = `?${saksnummerParam}${kaParam}`;

    await this.#createLoggedInCase(params);
    await this.deleteCase();
    await this.#createLoggedInCase(params);
  }

  async #createLoggedInCase(params: string) {
    if (this.#type === 'klageettersendelse') {
      await this.page.goto(`${UI_DOMAIN}/nb/ettersendelse/klage/${this.#ytelse}${params}`);
    } else if (this.#type === 'ankeettersendelse') {
      await this.page.goto(`${UI_DOMAIN}/nb/ettersendelse/anke/${this.#ytelse}${params}`);
    } else {
      await this.page.goto(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}${params}`);
    }

    await this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/begrunnelse`);
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
    this.#saksnummer = saksnummer;

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
    const label = this.page.getByLabel('Jeg skal sende med vedlegg.');

    return check ? label.check() : label.uncheck();
  }

  async goToOppsummering() {
    await this.page.getByText('Gå videre').click();

    if (this.#loggedIn) {
      return this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/oppsummering`);
    }

    if (this.#type === 'klageettersendelse') {
      return this.page.waitForURL(`${UI_DOMAIN}/nb/ettersendelse/klage/${this.#ytelse}/oppsummering`);
    }

    if (this.#type === 'ankeettersendelse') {
      return this.page.waitForURL(`${UI_DOMAIN}/nb/ettersendelse/anke/${this.#ytelse}/oppsummering`);
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

    if (this.#type === 'klage' || this.#type === 'anke') {
      expect(name).toContain(
        `Nav ${this.#type === 'anke' || this.#type === 'klage' ? this.#type : 'ettersendelse'} - `,
      );
    }

    if (this.#type === 'klageettersendelse') {
      await this.page.waitForURL(`${UI_DOMAIN}/nb/ettersendelse/klage/${this.#ytelse}/innsending`);
    } else if (this.#type === 'ankeettersendelse') {
      await this.page.waitForURL(`${UI_DOMAIN}/nb/ettersendelse/anke/${this.#ytelse}/innsending`);
    } else {
      await this.page.waitForURL(`${UI_DOMAIN}/nb/${this.#type}/${this.#ytelse}/innsending`);
    }

    this.verifyHvaGjørDuNå();
  }

  verifyHvaGjørDuNå() {
    if (this.#type === 'klageettersendelse' || this.#type === 'ankeettersendelse') {
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
      this.#type === 'klage' || this.#type === 'klageettersendelse'
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

    const KLAGE_LABEL = 'Hvorfor er du uenig?';
    const ANKE_LABEL = 'Hvorfor er du uenig i klagevedtaket?';
    const ETTERSENDELSE_LABEL = 'Har du noe å legge til?';

    if (this.#type === 'klage') {
      await clearIfNotEmpty(this.page, this.page.getByLabel(KLAGE_LABEL), apiUrl, this.#loggedIn);
      await this.page.getByLabel(KLAGE_LABEL).fill(begrunnelse);
      await this.page.keyboard.press('Tab');
    }

    if (this.#type === 'anke') {
      await clearIfNotEmpty(this.page, this.page.getByLabel(ANKE_LABEL), apiUrl, this.#loggedIn);
      await this.page.getByLabel(ANKE_LABEL).fill(begrunnelse);
      await this.page.keyboard.press('Tab');
    }

    if (this.#type === 'klageettersendelse' || this.#type === 'ankeettersendelse') {
      await clearIfNotEmpty(this.page, this.page.getByLabel(ETTERSENDELSE_LABEL), apiUrl, this.#loggedIn);
      await this.page.getByLabel(ETTERSENDELSE_LABEL).fill(begrunnelse);
      await this.page.keyboard.press('Tab');
    }

    if (requestPromise !== null) {
      await finishedRequest(requestPromise);
    }
  }

  checkJegForstårCheckbox() {
    if (this.#type === 'klage') {
      return this.page.getByLabel('Jeg forstår at jeg selv må skrive ut og sende klagen i posten selv.').check();
    }

    if (this.#type === 'anke') {
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
    await expect(this.page.getByText(this.#saksnummer)).toBeVisible();
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

  verifyFerdigUtfyltSaksnummer() {
    const label = this.page.locator('label').filter({ hasText: 'Saksnummer' });
    const container = this.page.locator('div').filter({ has: label });

    expect(container.getByText(this.#saksnummer)).toBeVisible();
  }

  async changeFerdigUtfyltSaksnummer(newSaksnummer: string) {
    const label = this.page.locator('label').filter({ hasText: 'Saksnummer' });
    const container = this.page.locator('div').filter({ has: label });
    await container.getByTitle('Endre').click();

    await this.insertSaksnummer(newSaksnummer);
    await this.page.locator('label').filter({ hasText: 'Saksnummer (valgfri)' }).waitFor();
    await this.verifySaksnummer();
  }

  async verifySaksnummer() {
    expect(await this.page.getByLabel('Saksnummer (valgfri)').inputValue()).toBe(this.#saksnummer);
  }

  async verifyBegrunnelse() {
    await this.page.reload();

    if (!this.#loggedIn) {
      expect(await this.page.getByLabel('Fødselsnummer, D-nummer eller NPID').inputValue()).toBe(this.#idNumber);
      expect(await this.page.getByLabel('For- og mellomnavn').inputValue()).toBe(this.#firstName);
      expect(await this.page.getByLabel('Etternavn').inputValue()).toBe(this.#lastName);

      if (this.#skalSendeMedVedlegg) {
        expect(this.page.getByLabel('Jeg skal sende med vedlegg.')).toBeChecked();
      } else {
        expect(this.page.getByLabel('Jeg skal sende med vedlegg.')).not.toBeChecked();
      }
    }

    await this.verifySaksnummer();

    if (this.#type === 'klage' || this.#type === 'klageettersendelse') {
      expect(await this.page.getByLabel('Vedtaksdato (valgfri)').inputValue()).toBe(this.#vedtaksdato);
    } else if (this.#type === 'anke') {
      expect(await this.page.getByLabel('Dato for klagevedtaket fra Nav klageinstans').inputValue()).toBe(
        this.#vedtaksdato,
      );
    }

    if (this.#type === 'klage') {
      expect(await this.page.getByLabel('Hvorfor er du uenig?').inputValue()).toBe(this.#begrunnelse);
    } else if (this.#type === 'anke') {
      expect(await this.page.getByLabel('Hvorfor er du uenig i klagevedtaket?').inputValue()).toBe(this.#begrunnelse);
    } else if (this.#type === 'klageettersendelse' || this.#type === 'ankeettersendelse') {
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

    if (this.#type === 'klage') {
      await this.page.getByTitle('Slett klagen og returner til hovedsiden').click();
    } else if (this.#type === 'anke') {
      await this.page.getByTitle('Slett anken og returner til hovedsiden').click();
    } else if (this.#type === 'klageettersendelse' || this.#type === 'ankeettersendelse') {
      await this.page.getByTitle('Slett ettersendelsen og returner til hovedsiden').click();
    }

    await this.page.getByTitle('Bekreft sletting').click();
    await finishedRequest(requestPromise);
    await this.page.waitForURL('https://login.microsoftonline.com/**');
  }

  async sendInn() {
    await this.page.getByText('Send inn').click();
    await this.page.waitForURL(`${UI_DOMAIN}/nb/sak/**/kvittering`);

    if (this.#type === 'klage') {
      expect(this.page.getByText('Kvittering for innsendt klage')).toBeVisible();
    } else if (this.#type === 'anke') {
      expect(this.page.getByText('Kvittering for innsendt anke')).toBeVisible();
    } else if (this.#type === 'klageettersendelse') {
      expect(this.page.getByText('Kvittering for ettersendelse til klage')).toBeVisible();
    } else if (this.#type === 'ankeettersendelse') {
      expect(this.page.getByText('Kvittering for ettersendelse til anke')).toBeVisible();
    }

    expect(this.page.getByText('Nå er resten vårt ansvar')).toBeVisible();
  }

  private async downloadLoggedInPdf() {
    const pagePromise = this.context.waitForEvent('page', { timeout: 10000 });

    if (this.#type === 'klage') {
      await this.page.getByText('Se og last ned klagen din').click();
    } else if (this.#type === 'anke') {
      await this.page.getByText('Se og last ned anken din').click();
    } else if (this.#type === 'klageettersendelse' || this.#type === 'ankeettersendelse') {
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
