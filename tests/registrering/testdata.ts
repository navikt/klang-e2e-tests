import {
  FristExtension,
  type GosysOppgaveQuery,
  Part,
  PartType,
  Sakstype,
  type SelectJournalpostParams,
} from '../../fixtures/registrering/types';

const SAKEN_GJELDER_ANKE = new Part('SPESIFIKK KUBBESTOL', '29461964263', PartType.SAKEN_GJELDER);
const SAKEN_GJELDER_KLAGE = new Part('SKEPTISK LANDSBY', '16036832758', PartType.SAKEN_GJELDER);
const SAKEN_GJELDER_OMGJØRINGSKRAV = new Part('SKEPTISK LANDSBY', '16036832758', PartType.SAKEN_GJELDER);

export const data = {
  ankendePart: new Part('FALSK ONKEL', '17887799784', PartType.KLAGER),
  fullmektig: new Part('FATTET ØRN MUSKEL', '14828897927', PartType.FULLMEKTIG),
  avsender: new Part('HUMORISTISK LOGG', '01046813711', PartType.AVSENDER),
  ekstraMottaker1: new Part('IVRIG JAK', '29480474455', PartType.EKSTRA_MOTTAKER),
  ekstraMottaker2: new Part('SANNSYNLIG MEDISIN', '06049939084', PartType.EKSTRA_MOTTAKER),
  ekstraMottaker3: new Part('DRIFTIG HVITKLØVER', '25046846764', PartType.EKSTRA_MOTTAKER),
  svarbrevName: 'E2E-dokumentnavn',
  svarbrevFullmektigNamae: 'E2E-fullmektig',
  sakenGjelderAddress1: 'E2E-adresselinje1',
  sakenGjelderAddress2: 'E2E-adresselinje2',
  sakenGjelderAddress3: 'E2E-adresselinje3',
  sakenGjelderLand: 'SØR-GEORGIA OG SØR-SANDWICHØYENE',
  ekstraMottakerAddress1: 'Ekstra mottakers E2E-adresselinje1',
  ekstraMottakerAddress2: 'Ekstra mottakers E2E-adresselinje2',
  ekstraMottakerAddress3: 'Ekstra mottakers E2E-adresselinje3',
  ekstraMottakerLand: 'HEARD- OG MCDONALD-ØYENE',
  fristIKabal: new FristExtension(68, 'måneder'),
  varsletFrist: new FristExtension(70, 'måneder'),
};

const ANKE_GOSYS_OPPGAVE: GosysOppgaveQuery = {
  opprettet: '11.10.2024',
  frist: '18.03.2030',
  tema: 'Sykepenger',
  gjelder: 'Klage',
  oppgavetype: 'Behandle sak (Manuell)',
  tildeltEnhetsnr: '4295',
  opprettetAvEnhetsnr: '4295',
};
const KLAGE_GOSYS_OPPGAVE: GosysOppgaveQuery = {
  opprettet: '10.10.2024',
  frist: '23.04.2030',
  tema: 'Sykepenger',
  gjelder: 'Klage',
  oppgavetype: 'Vurder henvendelse',
  tildeltEnhetsnr: '4291',
  opprettetAvEnhetsnr: '9999',
};

const OMGJØRINGSKRAV_GOSYS_OPPGAVE: GosysOppgaveQuery = {
  opprettet: '10.10.2024',
  frist: '23.04.2030',
  tema: 'Sykepenger',
  gjelder: 'Klage',
  oppgavetype: 'Vurder henvendelse',
  tildeltEnhetsnr: '4291',
  opprettetAvEnhetsnr: '9999',
};

export const ANKE: AnkeTestdata = {
  type: Sakstype.ANKE,
  sakenGjelder: SAKEN_GJELDER_ANKE,
  getJournalpostParams: {
    fagsakId: '712',
    title: 'Generelt brev',
    date: '23.08.2024',
    avsenderMottaker: 'SPESIFIKK KUBBESTOL',
  },
  hjemlerLong: ['Folketrygdloven - § 8-2', 'Folketrygdloven - § 22-17'],
  hjemlerShort: ['Ftrl - § 8-2', 'Ftrl - § 22-17'],
  mottattKlageinstans: '18.07.2024',
  tildeltSaksbehandler: 'F_Z994488 E_Z994488',
  gosysOppgave: ANKE_GOSYS_OPPGAVE,
};

export const KLAGE: KlageTestdata = {
  type: Sakstype.KLAGE,
  sakenGjelder: SAKEN_GJELDER_KLAGE,
  getJournalpostParams: {
    fagsakId: '1814',
    title: 'Generelt brev',
    date: '23.08.2024',
    avsenderMottaker: 'SKEPTISK LANDSBY',
  },
  hjemlerLong: ['Folketrygdloven - § 8-2', 'Folketrygdloven - § 22-17'],
  hjemlerShort: ['Ftrl - § 8-2', 'Ftrl - § 22-17'],
  mottattKlageinstans: '23.08.2024',
  tildeltSaksbehandler: 'F_Z994864 E_Z994864',
  gosysOppgave: KLAGE_GOSYS_OPPGAVE,
};

export const OMGJØRINGSKRAV: OmgjøringskravTestdata = {
  type: Sakstype.OMGJØRINGSKRAV,
  sakenGjelder: SAKEN_GJELDER_OMGJØRINGSKRAV,
  getJournalpostParams: {
    fagsakId: 'cde1',
    title: 'Generelt brev',
    date: '22.11.2024',
    avsenderMottaker: 'SKEPTISK LANDSBY',
  },
  hjemlerLong: ['Folketrygdloven - § 8-2', 'Folketrygdloven - § 22-17'],
  hjemlerShort: ['Ftrl - § 8-2', 'Ftrl - § 22-17'],
  mottattKlageinstans: '28.11.2024',
  tildeltSaksbehandler: 'F_Z994864 E_Z994864',
  gosysOppgave: OMGJØRINGSKRAV_GOSYS_OPPGAVE,
};

interface BaseTestdata {
  sakenGjelder: Part;
  getJournalpostParams: SelectJournalpostParams;
  hjemlerLong: string[];
  hjemlerShort: string[];
  mottattKlageinstans: string;
  tildeltSaksbehandler: string;
  gosysOppgave: GosysOppgaveQuery;
}

interface KlageTestdata extends BaseTestdata {
  type: Sakstype.KLAGE;
}

interface AnkeTestdata extends BaseTestdata {
  type: Sakstype.ANKE;
}

interface OmgjøringskravTestdata extends BaseTestdata {
  type: Sakstype.OMGJØRINGSKRAV;
}
