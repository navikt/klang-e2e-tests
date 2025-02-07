import test, { type Locator, type Page, expect } from '@playwright/test';
import { makeDirectApiRequest } from '../direct-api-request';
import { REGISTRERING_REGEX, STATUS_REGEX, feilregistrerAndDelete, finishedRequest } from '../helpers';
import { AnkePage } from './anke-page';
import { KlagePage } from './klage-page';
import { OmgjøringskravPage } from './omgjøringskrav-page';
import {
  type Ankevedtak,
  type Country,
  type FristExtension,
  type Klagevedtak,
  type Omgjøringskravvedtak,
  type Part,
  PartType,
  Sakstype,
  type SelectJournalpostParams,
  Utskriftstype,
  type Vedtak,
} from './types';

const LAND_REGEX = /Land.*/;
const SOME_CHAR_REGEX = /.+/;
export class KabinPage {
  #ankePage = new AnkePage(this.page);
  #klagePage = new KlagePage(this.page);
  #omgjøringskravPage = new OmgjøringskravPage(this.page);

  constructor(public readonly page: Page) {}

  setSakenGjelder = async (SAKEN_GJELDER: Part) =>
    test.step(`Sett saken gjelder: ${SAKEN_GJELDER.name}`, async () => {
      await this.page.getByPlaceholder('Opprett ny registrering').fill(SAKEN_GJELDER.id);
    });

  #getDocumentsContainer = async () => this.page.locator('section', { hasText: 'Velg journalpost' });

  #selectJournalpost = async (document: Locator) => {
    await document.waitFor();

    const [, title, tema, dato, avsenderMottaker, saksId, type] = await document
      .locator('article > *')
      .allTextContents();

    if (title === null || tema === null || dato === null || avsenderMottaker === null || saksId === null) {
      throw new Error('One or more document data is null');
    }

    const logiskeVedlegg = document.getByRole('list', { name: 'Logiske vedlegg', exact: true }).first();
    const logiskeVedleggNames = await logiskeVedlegg.locator('li').getByTestId('logisk-vedlegg').allTextContents();

    const vedlegg = document.getByRole('list', { name: 'Vedlegg', exact: true }).first();
    const vedleggNames = await vedlegg.locator('li').getByTestId('document-title').allTextContents();

    const requestPromise = this.page.waitForRequest('**/journalpost-id');
    await document.getByText('Velg').click();
    await finishedRequest(requestPromise);

    await document.locator('button[title="Valgt"]').waitFor();

    return { title, tema, dato, avsenderMottaker, saksId, type, logiskeVedleggNames, vedleggNames };
  };

  #journalpostFilterIndex = (filter: keyof SelectJournalpostParams) => {
    switch (filter) {
      case 'title':
        return 1;
      case 'tema':
        return 2;
      case 'date':
        return 3;
      case 'avsenderMottaker':
        return 4;
      case 'fagsakId':
        return 5;
      case 'type':
        return 6;
    }
  };

  #setJournalpostFilter = async (index: number, filter: string) => {
    const documents = await this.#getDocumentsContainer();
    await documents.getByRole('listitem').first().waitFor();
    const filters = this.page.getByRole('region', { name: 'Journalpostfiltere' });

    await filters.waitFor();

    await filters.locator('> *').nth(index).click();

    await filters.locator('> *').getByText(filter).check();
    await this.page.keyboard.press('Escape');
  };

  #setJournalpostFilterTitle = async (filter: string) => {
    const documents = await this.#getDocumentsContainer();
    await documents.getByRole('listitem').first().waitFor();
    const filters = this.page.getByRole('region', { name: 'Journalpostfiltere' });

    await filters.waitFor();

    await filters.getByPlaceholder('Tittel/journalpost-ID').fill(filter);
  };

  #setJournalpostFilters = async (params: SelectJournalpostParams) => {
    for (const [key, value] of Object.entries(params)) {
      if (key === 'title') {
        await this.#setJournalpostFilterTitle(value);
      }

      // TODO date

      if (key === 'tema' || key === 'avsenderMottaker' || key === 'fagsakId' || key === 'type') {
        await this.#setJournalpostFilter(this.#journalpostFilterIndex(key), value);
      }
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ¯\_(ツ)_/¯
  #getJournalpostByInnerText = async (params: SelectJournalpostParams) => {
    const documents = await this.#getDocumentsContainer();
    await documents.getByRole('listitem').first().waitFor();

    const listitems = await documents.getByRole('listitem').all();

    await this.#setJournalpostFilters(params);

    for (const listitem of listitems) {
      const [, title, tema, dato, avsenderMottaker, saksId, type] = await listitem
        .locator('article > *')
        .allTextContents();

      if (params.title !== undefined && title !== params.title) {
        continue;
      }

      if (params.tema !== undefined && tema !== params.tema) {
        continue;
      }

      if (params.date !== undefined && dato !== params.date) {
        continue;
      }

      if (params.avsenderMottaker !== undefined && avsenderMottaker !== params.avsenderMottaker) {
        continue;
      }

      if (params.fagsakId !== undefined && saksId !== params.fagsakId) {
        continue;
      }

      if (params.type !== undefined && type !== params.type) {
        continue;
      }

      return listitem;
    }

    throw new Error(`Could not find journalpost with given parameters: ${JSON.stringify(params)}`);
  };

  selectJournalpostByInnerText = async (params: SelectJournalpostParams) =>
    test.step('Velg journalpost', async () => {
      const journalpost = (await this.#getJournalpostByInnerText(params)).first();

      return this.#selectJournalpost(journalpost);
    });

  selectType = async (type: Sakstype) => {
    const requestPromise = this.page.waitForRequest('**/registreringer/**/type-id');

    switch (type) {
      case Sakstype.KLAGE:
        await this.#klagePage.selectKlage();
        break;
      case Sakstype.ANKE:
        await this.#ankePage.selectAnke();
        break;
      case Sakstype.OMGJØRINGSKRAV:
        await this.#omgjøringskravPage.selectOmgjøringskrav();
        break;
    }

    await finishedRequest(requestPromise);
  };

  #getMuligheterName = (type: Sakstype) => {
    switch (type) {
      case Sakstype.KLAGE:
        return 'Klagemuligheter';
      case Sakstype.ANKE:
        return 'Ankemuligheter';
      case Sakstype.OMGJØRINGSKRAV:
        return 'Omgjøringskravmuligheter';
    }
  };

  selectFirstAvailableVedtak = (type: Sakstype) =>
    test.step('Velg første mulige vedtak', async () => {
      const muligheter = this.page.getByRole('table', { name: this.#getMuligheterName(type) });
      await muligheter.waitFor({ timeout: 20_000 });
      const row = muligheter.locator('tbody tr');

      const mulighet = row.filter({ has: this.page.getByText('Velg') }).first();
      await mulighet.waitFor();

      const requestPromise = this.page.waitForRequest('**/registreringer/**/mulighet');

      const button = row.getByRole('button', { name: 'Velg' }).first();

      const id = await button.getAttribute('data-testid');

      if (id === null) {
        throw new Error('Could not find data-testid attribute on td holding select button');
      }

      await button.click();
      await finishedRequest(requestPromise);

      const selected = muligheter.getByTestId(id);
      await expect(selected).toHaveAttribute('title', 'Valgt');

      const selectedRow = row.filter({ has: this.page.getByTestId(id) });

      const cells = await selectedRow.getByRole('cell').all();

      return this.#getVedtakData(type, cells);
    });

  #getVedtakData = async (type: Sakstype, cells: Locator[]): Promise<Vedtak> => {
    switch (type) {
      case Sakstype.KLAGE: {
        const data = await this.#getKlagevedtakData(cells);

        return { data, type };
      }
      case Sakstype.ANKE: {
        const data = await this.#getAnkevedtakData(cells);

        return { data, type };
      }
      case Sakstype.OMGJØRINGSKRAV: {
        const data = await this.#getOmgoringskravvedtakData(cells);

        return { data, type };
      }
    }
  };

  #getOmgoringskravvedtakData = async (cells: Locator[]): Promise<Omgjøringskravvedtak> =>
    this.#getAnkevedtakData(cells);

  #getAnkevedtakData = async (cells: Locator[]): Promise<Ankevedtak> => {
    const [type, fagsakId, tema, ytelse, vedtaksdato, fagsystem] = await Promise.all(
      cells.map(async (cell) => cell.textContent()),
    );

    if (
      type === null ||
      fagsakId === null ||
      tema === null ||
      ytelse === null ||
      fagsystem === null ||
      vedtaksdato === null
    ) {
      throw new Error('One or more mulighet data is null');
    }

    return { type, fagsakId, tema, ytelse, vedtaksdato, fagsystem };
  };

  #getKlagevedtakData = async (cells: Locator[]): Promise<Klagevedtak> => {
    const [fagsakId, tema, vedtaksdato, behandlendeEnhet, fagsystem] = await Promise.all(
      cells.map(async (cell) => cell.textContent()),
    );

    if (fagsakId === null || tema === null || vedtaksdato === null || behandlendeEnhet === null || fagsystem === null) {
      throw new Error('One or more mulighet data is null');
    }

    return { fagsakId, tema, vedtaksdato, behandlendeEnhet, fagsystem };
  };

  getYtelse = () => this.page.getByTestId('ytelseId').textContent();

  verifySaksId = async (jpSaksId: string, mulighetSaksId: string) => {
    if (jpSaksId !== mulighetSaksId) {
      await test.step('Verifiser melding om ny saksId', () => {
        this.page.getByText(
          `Journalposten er tidligere journalført på fagsak-ID ${jpSaksId}. Ved opprettelse av behandling i Kabal vil innholdet kopieres over i en ny journalpost på fagsak-ID ${mulighetSaksId}.`,
        );
      });
    }
  };

  setMottattKlageinstans = async (vedtaksdato: string) =>
    test.step(`Sett Mottatt Klageinstans: ${vedtaksdato}`, async () => {
      await this.page.getByRole('textbox', { name: 'Mottatt Klageinstans' }).clear();

      await this.page.waitForTimeout(500);

      const requestPromise = this.page.waitForRequest('**/registreringer/**/overstyringer/mottatt-klageinstans');
      await this.page.getByLabel('Mottatt Klageinstans').fill(vedtaksdato);
      await this.page.keyboard.press('Tab');
      await finishedRequest(requestPromise);

      const value = this.page.getByRole('textbox', { name: 'Mottatt Klageinstans' });
      await expect(value).toHaveAttribute('value', vedtaksdato);
    });

  setFristIKabal = async (frist: FristExtension, vedtaksdato: string) =>
    test.step(`Sett frist i Kabal: ${frist.getTestLabel(vedtaksdato)}`, async () => {
      const fristSection = this.page.getByRole('region', { name: 'Frist i Kabal' });
      await fristSection.waitFor();

      await fristSection.locator('input').fill(frist.value.toString());
      await fristSection.getByText('måneder', { exact: true }).click();
      const expectedFristIKabal = frist.getExtendedDate(vedtaksdato);

      await fristSection.getByText(expectedFristIKabal).waitFor();
    });

  setHjemler = async (longNames: string[], shortNames: string[]) =>
    test.step(`Sett hjemler: ${shortNames.join(', ')}`, async () => {
      await this.page.getByLabel('Hjemler').click();
      await this.page.getByText('Fjern alle').click();
      await this.page.locator('#hjemmelIdList').filter({ hasNotText: SOME_CHAR_REGEX }).waitFor();

      for (const longName of longNames) {
        const requestPromise = this.page.waitForRequest('**/hjemmel-id-list');
        await this.page.getByText(longName, { exact: true }).click();
        await finishedRequest(requestPromise);
      }

      for (const shortName of shortNames) {
        await this.page.getByText(shortName, { exact: true }).click();
      }

      await this.page.getByLabel('Hjemler').click();
    });

  verifySakenGjelder = async (part: Part) =>
    test.step(`Verifiser saken gjelder: ${part.name}`, async () => {
      const sakenGjelderContainer = this.page.locator('[id="sakenGjelder"]');
      const sakenGjelder = (await sakenGjelderContainer.textContent())?.replace('Saken gjelder', '').trim();

      expect(sakenGjelder).toBe(part.getNameAndId());
    });

  #setKlagerOrAnkendePart = async (part: Part) => {
    const klagerContainer = this.page.locator('[id="klager"]');
    await klagerContainer.getByText('Søk').click();
    await klagerContainer.getByPlaceholder('Søk på ID-nummer').fill(part.id);
    await klagerContainer.getByText('Bruk').click();
  };

  setAnkendePart = async (part: Part) =>
    test.step(`Sett ankende part: ${part.name}`, async () => this.#setKlagerOrAnkendePart(part));

  setKlager = async (part: Part) =>
    test.step(`Sett klager: ${part.name}`, async () => this.#setKlagerOrAnkendePart(part));

  setFullmektig = async (part: Part) =>
    test.step(`Sett fullmektig: ${part.name}`, async () => {
      const fullmektigContainer = this.page.locator('[id="fullmektig"]');
      await fullmektigContainer.getByText('Søk').click();
      await fullmektigContainer.getByPlaceholder('Søk på ID-nummer').fill(part.id);
      await fullmektigContainer.getByText('Bruk').click();
    });

  setAvsender = async (part: Part) =>
    test.step(`Sett avsender: ${part.name}`, async () => {
      const fullmektigContainer = this.page.locator('[id="avsender"]');
      await fullmektigContainer.getByText('Søk').click();
      await fullmektigContainer.getByPlaceholder('Søk på ID-nummer').fill(part.id);
      await fullmektigContainer.getByText('Bruk').click();
    });

  setSaksbehandler = async (label: string) =>
    test.step('Sett saksbehandler', async () => {
      const saksbehandlerContainer = this.page.locator('[id="saksbehandlerId"]');
      await saksbehandlerContainer.getByLabel('Saksbehandler').selectOption({ label });
    });

  getSvarbrevSection = async () => this.page.getByRole('region', { name: 'Svarbrev' });

  setSendSvarbrev = async (send: boolean) =>
    test.step(`Velge å${send ? ' ' : ' ikke '}sende svarbrev`, () => {
      this.page.getByText(send ? 'Send svarbrev' : 'Ikke send svarbrev', { exact: true }).click();
    });

  setSvarbrevDocumentName = async (documentName: string) =>
    test.step(`Sett tittel for svarbrev: ${documentName} `, async () => {
      const svarbrevSection = await this.getSvarbrevSection();
      await svarbrevSection.getByLabel('Dokumentnavn').fill(documentName);
    });

  setSvarbrevFullmektigName = async (fullmektigName: string) =>
    test.step(`Sett navn på fullmektig i svarbrev: ${fullmektigName}`, async () => {
      const svarbrevSection = await this.getSvarbrevSection();
      await svarbrevSection.getByLabel('Navn på fullmektig i brevet').clear();
      await svarbrevSection.getByLabel('Navn på fullmektig i brevet').fill(fullmektigName);
    });

  setSvarbrevVarsletFrist = async (varsletFrist: FristExtension) =>
    test.step(`Sett varslet frist i svarbrev: ${varsletFrist.getTestLabel()}`, async () => {
      const svarbrevSection = await this.getSvarbrevSection();
      await svarbrevSection.getByText('Overstyr', { exact: true }).first().click();
      await svarbrevSection.locator('input[id="frist"]').fill(varsletFrist.value.toString());
      await svarbrevSection.getByText(varsletFrist.unit, { exact: true }).click();
      svarbrevSection.getByText(
        'Du har endret foreslått frist med mer enn seks måneder. Er du sikker på at dette er riktig?',
      );
    });

  setSvarbrevFritekst = async (fritekst: string) =>
    test.step(`Sett fritekst i svarbrev: ${fritekst}`, async () => {
      const svarbrevSection = await this.getSvarbrevSection();
      await svarbrevSection.getByText('Overstyr', { exact: true }).last().click();
      await svarbrevSection.getByLabel('Fritekst').fill(fritekst);
    });

  #partTypeToText = (partType: PartType) => {
    switch (partType) {
      case PartType.SAKEN_GJELDER:
        return 'Saken gjelder';
      case PartType.FULLMEKTIG:
        return 'Fullmektig';
      case PartType.KLAGER:
        return 'Ankende part';
      case PartType.AVSENDER:
        return 'Avsender';
      case PartType.EKSTRA_MOTTAKER:
        return 'Ekstra mottaker';
    }
  };

  selectMottaker = async (part: Part) =>
    test.step(`Velg mottaker: ${part.getTestLabelWithType()}`, async () => {
      const svarbrevSection = await this.getSvarbrevSection();
      await svarbrevSection.getByText(`${part.name} (${this.#partTypeToText(part.type)})`).click();
    });

  #getSvarbrevPartSection = async (part: Part) => {
    const svarbrevSection = await this.getSvarbrevSection();

    return svarbrevSection.getByTestId('document-send-receiver-list').getByRole('region', { name: part.name });
  };

  #changeAddress = async (
    partSection: Locator,
    address1?: string,
    address2?: string,
    address3?: string,
    country?: Country,
  ) => {
    await partSection.getByText('Endre', { exact: true }).click();

    if (typeof address1 === 'string') {
      await partSection.getByLabel('Adresselinje 1').fill(address1);
    }

    if (typeof address2 === 'string') {
      await partSection.getByLabel('Adresselinje 2').fill(address2);
    }

    if (typeof address3 === 'string') {
      await partSection.getByLabel('Adresselinje 3').fill(address3);
    }

    if (typeof country !== 'undefined') {
      await partSection.getByLabel(LAND_REGEX).fill(country.search);
      await partSection.getByText(country.fullName).click();
    }

    await partSection.getByText('Lagre').click();
  };

  changeAddressForPart = async (
    part: Part,
    address1?: string,
    address2?: string,
    address3?: string,
    country?: Country,
  ) =>
    test.step(`Endre adresse for part: ${part.getTestLabelWithType()}`, async () => {
      const svarbrevSection = await this.getSvarbrevSection();
      const partSection = svarbrevSection
        .getByTestId('document-send-receiver-list')
        .getByRole('region', { name: part.name });

      return this.#changeAddress(partSection, address1, address2, address3, country);
    });

  changeAddressForExtraReceiver = async (
    part: Part,
    address1?: string,
    address2?: string,
    address3?: string,
    country?: Country,
  ) =>
    test.step(`Endre adresse for ekstra mottaker: ${part.getTestLabelWithType()}`, () => {
      const list = this.page.getByRole('list', { name: 'Liste over ekstra mottakere' });
      const section = list.getByRole('listitem', { name: part.name });

      return this.#changeAddress(section, address1, address2, address3, country);
    });

  setUtskriftTypeForPart = async (part: Part, type: Utskriftstype) =>
    test.step(`Velg utskriftstype: ${type} for part: ${part.getTestLabelWithType()}`, async () => {
      const section = await this.#getSvarbrevPartSection(part);

      switch (type) {
        case Utskriftstype.LOKAL:
          return section.getByText('Lokal utskrift').click();
        case Utskriftstype.SENTRAL:
          return section.getByText('Sentral utskrift').click();
      }
    });

  setUtskriftTypeForExtraReceiver = async (part: Part, type: Utskriftstype) =>
    test.step(`Velg utskriftstype: ${type} for ekstra mottaker: ${part.getTestLabelWithType()}`, () => {
      const list = this.page.getByRole('list', { name: 'Liste over ekstra mottakere' });
      const section = list.getByRole('listitem', { name: part.name });

      switch (type) {
        case Utskriftstype.LOKAL:
          return section.getByText('Lokal utskrift').click();
        case Utskriftstype.SENTRAL:
          return section.getByText('Sentral utskrift').click();
      }
    });

  addExtraReceiver = async (part: Part) =>
    test.step(`Legg til ekstra mottaker: ${part.getTestLabelWithType()}`, async () => {
      const svarbrevSection = await this.getSvarbrevSection();
      const ekstraMottakere = svarbrevSection.locator('section', { hasText: 'Ekstra mottakere' });
      const input = ekstraMottakere.locator('input').first();
      await input.fill(part.id);
      const requestPromise = this.page.waitForRequest('**/receivers');
      await ekstraMottakere.getByText('Legg til mottaker').click();
      await finishedRequest(requestPromise);
      await input.filter({ hasNotText: part.id }).waitFor();
      await this.page.waitForTimeout(500);
    });

  #getFinishText = (type: Sakstype) => {
    switch (type) {
      case Sakstype.KLAGE:
        return 'Klage opprettet';
      case Sakstype.ANKE:
        return 'Anke opprettet';
      case Sakstype.OMGJØRINGSKRAV:
        return 'Omgjøringskrav opprettet';
    }
  };

  finish = async (type: Sakstype) =>
    test.step('Fullfør', async () => {
      await this.page.getByText('Fullfør', { exact: true }).click();
      const requestPromise = this.page.waitForRequest('**/registreringer/**/ferdigstill');
      await this.page.getByText('Bekreft', { exact: true }).click();
      const request = await requestPromise;
      const response = await request.response();

      if (response === null) {
        throw new Error('No response');
      }

      await this.page.waitForURL(STATUS_REGEX);

      const res: unknown = await response.json();

      if (!isStatusResponse(res)) {
        throw new Error('Invalid response');
      }

      feilregistrerAndDelete(this.page, res.behandlingId);

      await this.page.getByText(this.#getFinishText(type)).waitFor();
    });

  deleteRegistrering = async () => {
    const url = this.page.url();

    const registreringMatch = url.match(REGISTRERING_REGEX);

    if (registreringMatch !== null) {
      const [, registreringId] = registreringMatch;

      if (typeof registreringId === 'string') {
        await makeDirectApiRequest(this.page, 'kabin-api', `/registrering/${registreringId}`, 'DELETE');

        console.info('Deleted registrering with id:', registreringId);

        return;
      }
    }

    console.warn(`Could not delete registrering with url: ${url}`);
  };
}

const isStatusResponse = (response: unknown): response is { behandlingId: string } =>
  typeof response === 'object' &&
  response !== null &&
  'behandlingId' in response &&
  typeof response.behandlingId === 'string';
