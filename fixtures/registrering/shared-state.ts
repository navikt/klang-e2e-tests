import type { Innsendingsytelse } from '@/fixtures/innsendingsytelse';

export enum Type {
  Klage = 'klage',
  Anke = 'anke',
  Klageettersendelse = 'ettersendelse/klage',
  Ankeettersendelse = 'ettersendelse/anke',
}

const TYPE_PATH_SEGMENTS: Record<Type, string> = {
  [Type.Klage]: 'klage',
  [Type.Anke]: 'anke',
  [Type.Klageettersendelse]: 'ettersendelse',
  [Type.Ankeettersendelse]: 'ettersendelse/anke',
};

export const getCasePath = (type: Type | null, ytelse: Innsendingsytelse | null): string => {
  if (type === null || ytelse === null) {
    throw new Error(`Type and ytelse must be set. Type: ${type}, ytelse: ${ytelse}`);
  }

  return `/nb/${TYPE_PATH_SEGMENTS[type]}/${ytelse}`;
};

export interface SharedState {
  ytelse: Innsendingsytelse | null;
  type: Type | null;
  idNumber: string;
  firstName: string;
  lastName: string;
  vedtaksdato: string;
  userSaksnummer: string;
  begrunnelse: string;
  skalSendeMedVedlegg: boolean;
  hasUploadedAttachments: boolean;
  internalSaksnummer: string | null;
  harMottattBrev: boolean | null;
}

export const createSharedState = (): SharedState => ({
  ytelse: null,
  type: null,
  idNumber: '',
  firstName: '',
  lastName: '',
  vedtaksdato: '',
  userSaksnummer: '',
  begrunnelse: '',
  skalSendeMedVedlegg: false,
  hasUploadedAttachments: false,
  internalSaksnummer: null,
  harMottattBrev: null,
});

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
export const LOGGED_IN_SAK_REGEX = new RegExp(`http(?:s?)://(?:.+)/sak/(${UUID.source})`);

interface DeepLink {
  saksnummer?: string | null;
  ka?: boolean | null;
  sakstype?: string | null;
  fagsystem?: string | null;
}

export const toQueryParams = (params: DeepLink) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }

    switch (typeof value) {
      case 'string': {
        if (value.length > 0) {
          query.append(key, value);
        }
        break;
      }

      case 'boolean': {
        query.append(key, value ? 'true' : 'false');
        break;
      }
    }
  }

  return query.toString();
};
