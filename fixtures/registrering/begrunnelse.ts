import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import { clearIfNotEmpty, finishedRequest, formatId } from '@/fixtures/helpers';
import { checkLoggedIn } from '@/fixtures/registrering/login';
import type { SharedState } from '@/fixtures/registrering/shared-state';
import { Type } from '@/fixtures/registrering/shared-state';

const TESTDATA_DIR = path.resolve(import.meta.dirname, '..', '..', 'testdata');

const VEDLEGG_REGEX = /Vedlegg.*/;
const SLETT_REGEX = /Slett.*/;

export class BegrunnelsePage {
  constructor(
    private page: Page,
    private state: SharedState,
  ) {}

  insertIdNumber(idNumber: string) {
    this.state.idNumber = idNumber;
    return this.page.getByLabel('Fødselsnummer, D-nummer eller NPID').fill(idNumber);
  }

  insertFirstName(firstName: string) {
    this.state.firstName = firstName;
    return this.page.getByLabel('For- og mellomnavn').fill(firstName);
  }

  insertLastName(lastName: string) {
    this.state.lastName = lastName;
    return this.page.getByLabel('Etternavn').fill(lastName);
  }

  async insertSaksnummer(saksnummer: string) {
    this.state.userSaksnummer = saksnummer;

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

  async insertVedtaksdato(vedtaksdato: string) {
    this.state.vedtaksdato = vedtaksdato;

    const label =
      this.state.type === Type.Klage || this.state.type === Type.Klageettersendelse
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
    this.state.begrunnelse = begrunnelse;

    const isLoggedIn = await checkLoggedIn(this.page);

    const apiUrl = '**/api/klanker/**/fritekst';
    const requestPromise = isLoggedIn ? this.page.waitForRequest(apiUrl) : null;

    const label = this.#begrunnelseLabel();

    await clearIfNotEmpty(this.page, this.page.getByLabel(label), apiUrl, isLoggedIn);
    await this.page.getByLabel(label).fill(begrunnelse);
    await this.page.keyboard.press('Tab');

    if (requestPromise !== null) {
      await finishedRequest(requestPromise);
    }
  }

  async checkVedleggCheckbox(check = true) {
    this.state.skalSendeMedVedlegg = check;
    const checkbox = this.page.getByRole('checkbox', { name: 'Jeg skal sende med vedlegg.' });

    await (check ? checkbox.check() : checkbox.uncheck());
  }

  async checkHarMottattBrevCheckbox(check = true) {
    this.state.harMottattBrev = check;

    const legend = this.page.getByRole('radiogroup', {
      name: 'Har du mottatt et brev fra Klageinstans eller en annen enhet i Nav om at saken din er sendt til Klageinstans?',
    });

    if (check) {
      await legend.getByLabel('Ja').click();
    } else {
      await legend.getByLabel('Nei').click();
    }
  }

  async uploadAttachments() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (!isLoggedIn) {
      throw new Error(
        'uploadAttachments() can only be used when logged in. Use checkVedleggCheckbox() for unauthenticated cases.',
      );
    }

    await this.#deleteAllVedlegg();

    await this.page
      .locator('[id="file-upload-input"]')
      .setInputFiles([
        path.join(TESTDATA_DIR, 'dummy.pdf'),
        path.join(TESTDATA_DIR, 'logo.png'),
        path.join(TESTDATA_DIR, 'logo.jpg'),
      ]);

    // Wait for all uploads to complete
    await this.#verifyAttachments();
  }

  async verify() {
    await this.#verifyPersonalInfo();

    await this.#verifySaksnummer();

    if (this.state.type === Type.Klage || this.state.type === Type.Klageettersendelse) {
      expect(await this.page.getByLabel('Vedtaksdato (valgfri)').inputValue()).toBe(this.state.vedtaksdato);
    } else if (this.state.type === Type.Anke) {
      expect(await this.page.getByLabel('Dato for klagevedtaket fra Klageinstans').inputValue()).toBe(
        this.state.vedtaksdato,
      );
    }

    if (this.state.type === Type.Klageettersendelse) {
      await this.#verifyMottattBrev();
    }

    if (this.state.type === Type.Klage) {
      expect(await this.page.getByLabel('Hvorfor er du uenig?').inputValue()).toBe(this.state.begrunnelse);
    } else if (this.state.type === Type.Anke) {
      expect(await this.page.getByLabel('Hvorfor er du uenig i klagevedtaket?').inputValue()).toBe(
        this.state.begrunnelse,
      );
    } else if (this.state.type === Type.Klageettersendelse || this.state.type === Type.Ankeettersendelse) {
      expect(await this.page.getByLabel('Har du noe å legge til?').inputValue()).toBe(this.state.begrunnelse);
    }

    const isLoggedIn = await checkLoggedIn(this.page);

    if (!isLoggedIn) {
      const vedleggCheckbox = this.page.getByRole('checkbox', { name: 'Jeg skal sende med vedlegg.' });

      if (this.state.skalSendeMedVedlegg) {
        await expect(vedleggCheckbox).toBeChecked();
      } else {
        await expect(vedleggCheckbox).not.toBeChecked();
      }
    }

    if (this.state.hasUploadedAttachments) {
      await this.#verifyAttachments();
    }
  }

  async #verifySaksnummer() {
    if (this.state.internalSaksnummer !== null) {
      const section = this.page.locator('section').filter({ hasText: 'Saksnummer' });

      await expect(section.getByText(this.state.internalSaksnummer)).toBeVisible();
    } else {
      expect(await this.page.getByLabel('Saksnummer (valgfri)').inputValue()).toBe(this.state.userSaksnummer);
    }
  }

  async #verifyMottattBrev() {
    const legend = this.page.getByRole('radiogroup', {
      name: 'Har du mottatt et brev fra Klageinstans eller en annen enhet i Nav om at saken din er sendt til Klageinstans?',
    });

    if (this.state.harMottattBrev) {
      await expect(legend.getByLabel('Ja')).toBeChecked();
    } else if (this.state.harMottattBrev === false) {
      await expect(legend.getByLabel('Nei')).toBeChecked();
    } else {
      await expect(legend.getByLabel('Ja')).not.toBeChecked();
      await expect(legend.getByLabel('Nei')).not.toBeChecked();
    }
  }

  async #verifyPersonalInfo() {
    const isLoggedIn = await checkLoggedIn(this.page);

    if (isLoggedIn) {
      const firstNameSection = this.#getSectionByHeading('For- og mellomnavn');
      await firstNameSection.waitFor();
      const lastNameSection = this.#getSectionByHeading('Etternavn');
      const idNumberSection = this.#getSectionByHeading('Fødselsnummer, D-nummer eller NPID');

      await expect(firstNameSection).toContainText(this.state.firstName);
      await expect(lastNameSection).toContainText(this.state.lastName);
      await expect(idNumberSection).toContainText(formatId(this.state.idNumber));
    } else {
      await expect(this.page.getByLabel('Fødselsnummer, D-nummer eller NPID')).toBeVisible();
      expect(await this.page.getByLabel('Fødselsnummer, D-nummer eller NPID').inputValue()).toBe(this.state.idNumber);
      expect(await this.page.getByLabel('For- og mellomnavn').inputValue()).toBe(this.state.firstName);
      expect(await this.page.getByLabel('Etternavn').inputValue()).toBe(this.state.lastName);
    }
  }

  async submit() {
    await this.page.getByText('Gå videre').click();

    const isLoggedIn = await checkLoggedIn(this.page);
    const url = isLoggedIn
      ? `${UI_DOMAIN}/nb/sak/**/oppsummering`
      : `${UI_DOMAIN}/nb/${this.state.type}/${this.state.ytelse}/oppsummering`;

    await this.page.waitForURL(url);
  }

  #begrunnelseLabel(): string {
    switch (this.state.type) {
      case Type.Klage:
        return 'Hvorfor er du uenig?';
      case Type.Anke:
        return 'Hvorfor er du uenig i klagevedtaket?';
      case Type.Klageettersendelse:
      case Type.Ankeettersendelse:
        return 'Har du noe å legge til?';
      default:
        throw new Error(`Unknown type: ${this.state.type}`);
    }
  }

  async #verifyAttachments() {
    await expect(this.page.getByText('Vedlegg (3)')).toBeVisible();
    await expect(this.page.getByText('dummy.pdf')).toBeVisible();
    await expect(this.page.getByText('logo.png')).toBeVisible();
    await expect(this.page.getByText('logo.jpg')).toBeVisible();

    this.state.hasUploadedAttachments = true;
  }

  async #deleteAllVedlegg() {
    await this.page.getByText(VEDLEGG_REGEX, { exact: true }).waitFor();

    const items = await this.page
      .locator('li')
      .filter({ has: this.page.getByTitle(SLETT_REGEX, { exact: true }) })
      .all();

    for (const li of items.reverse()) {
      const requestPromise = this.page.waitForRequest('**/api/klanker/**/vedlegg/**');
      await li.locator('button').click();
      await finishedRequest(requestPromise);
    }
  }

  #getSectionByHeading = (heading: string) =>
    this.page.locator('section', { has: this.page.getByRole('heading', { name: heading }) });
}
