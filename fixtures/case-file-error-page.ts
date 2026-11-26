import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import { Language } from '@/fixtures/case-files';

export enum CaseFileType {
  ATTACHMENT = 'attachment',
  PDF = 'pdf',
}

/** HTTP statuses the server responds with when it cannot serve a case file. */
export enum CaseFileErrorStatus {
  /** The file does not exist. E.g. a manipulated ID, or deleted by the user or the system. */
  NOT_FOUND = 404,
  /** The case has been sent in, so the file is gone as expected. */
  GONE = 410,
  /** Unexpected response from the API. */
  ERROR = 502,
}

interface CaseFileErrorTexts {
  title: string;
  description: string;
}

type CaseFileErrorTextsByStatus = Record<CaseFileErrorStatus, CaseFileErrorTexts>;

export interface CaseFileErrorPageTexts {
  [CaseFileType.ATTACHMENT]: CaseFileErrorTextsByStatus;
  [CaseFileType.PDF]: CaseFileErrorTextsByStatus;
  tryAgain: string;
  goToMinSide: string;
}

export const CASE_FILE_ERROR_PAGE: Record<Language, CaseFileErrorPageTexts> = {
  [Language.NB]: {
    [CaseFileType.ATTACHMENT]: {
      [CaseFileErrorStatus.NOT_FOUND]: {
        title: 'Fant ikke vedlegget',
        description: 'Vedlegget finnes ikke. Det kan ha blitt slettet.',
      },
      [CaseFileErrorStatus.GONE]: {
        title: 'Vedlegget er ikke lenger tilgjengelig',
        description:
          'Saken er sendt inn, og vedleggene er derfor slettet herfra. Vedleggene ble sendt inn sammen med saken. Du finner saken din på Min side.',
      },
      [CaseFileErrorStatus.ERROR]: {
        title: 'Noe gikk galt',
        description: 'Vi kunne ikke hente vedlegget akkurat nå. Prøv igjen om litt.',
      },
    },
    [CaseFileType.PDF]: {
      [CaseFileErrorStatus.NOT_FOUND]: {
        title: 'Fant ikke PDF-en',
        description: 'PDF-en finnes ikke.',
      },
      [CaseFileErrorStatus.GONE]: {
        title: 'PDF-en er ikke lenger tilgjengelig',
        description:
          'Saken er sendt inn, og PDF-en er derfor ikke lenger tilgjengelig her. Du finner saken din på Min side.',
      },
      [CaseFileErrorStatus.ERROR]: {
        title: 'Noe gikk galt',
        description: 'Vi kunne ikke hente PDF-en akkurat nå. Prøv igjen om litt.',
      },
    },
    tryAgain: 'Prøv igjen',
    goToMinSide: 'Gå til Min side',
  },
  [Language.NN]: {
    [CaseFileType.ATTACHMENT]: {
      [CaseFileErrorStatus.NOT_FOUND]: {
        title: 'Fann ikkje vedlegget',
        description: 'Vedlegget finst ikkje. Det kan ha blitt sletta.',
      },
      [CaseFileErrorStatus.GONE]: {
        title: 'Vedlegget er ikkje lenger tilgjengeleg',
        description:
          'Saka er send inn, og vedlegga er difor sletta herifrå. Vedlegga vart sende inn saman med saka. Du finn saka di på Mi side.',
      },
      [CaseFileErrorStatus.ERROR]: {
        title: 'Noko gjekk gale',
        description: 'Vi kunne ikkje hente vedlegget akkurat no. Prøv igjen om litt.',
      },
    },
    [CaseFileType.PDF]: {
      [CaseFileErrorStatus.NOT_FOUND]: {
        title: 'Fann ikkje PDF-en',
        description: 'PDF-en finst ikkje.',
      },
      [CaseFileErrorStatus.GONE]: {
        title: 'PDF-en er ikkje lenger tilgjengeleg',
        description: 'Saka er send inn, og PDF-en er difor ikkje lenger tilgjengeleg her. Du finn saka di på Mi side.',
      },
      [CaseFileErrorStatus.ERROR]: {
        title: 'Noko gjekk gale',
        description: 'Vi kunne ikkje hente PDF-en akkurat no. Prøv igjen om litt.',
      },
    },
    tryAgain: 'Prøv igjen',
    goToMinSide: 'Gå til Mi side',
  },
  [Language.EN]: {
    [CaseFileType.ATTACHMENT]: {
      [CaseFileErrorStatus.NOT_FOUND]: {
        title: 'Attachment not found',
        description: 'The attachment does not exist. It may have been deleted.',
      },
      [CaseFileErrorStatus.GONE]: {
        title: 'The attachment is no longer available',
        description:
          'The case has been submitted, so the attachments have been deleted from here. The attachments were submitted together with the case. You can find your case on My page.',
      },
      [CaseFileErrorStatus.ERROR]: {
        title: 'Something went wrong',
        description: 'We could not retrieve the attachment right now. Please try again shortly.',
      },
    },
    [CaseFileType.PDF]: {
      [CaseFileErrorStatus.NOT_FOUND]: {
        title: 'PDF not found',
        description: 'The PDF does not exist.',
      },
      [CaseFileErrorStatus.GONE]: {
        title: 'The PDF is no longer available',
        description:
          'The case has been submitted, so the PDF is no longer available here. You can find your case on My page.',
      },
      [CaseFileErrorStatus.ERROR]: {
        title: 'Something went wrong',
        description: 'We could not retrieve the PDF right now. Please try again shortly.',
      },
    },
    tryAgain: 'Try again',
    goToMinSide: 'Go to My page',
  },
};

/** The tests run against dev or locally, where the app links to Min side in dev. */
const MIN_SIDE_URL = 'https://www.intern.dev.nav.no/minside';

const getMinSideUrl = (lang: Language): string => `${MIN_SIDE_URL}/${lang}`;

export interface CaseFileErrorResponseExpectation {
  path: string;
  status: CaseFileErrorStatus;
}

export interface CaseFileErrorPageExpectation extends CaseFileErrorResponseExpectation {
  lang: Language;
  fileType: CaseFileType;
}

/** Verifies the raw server response: the app with the real status code, which the frontend reads from `data-status`. */
export const verifyCaseFileErrorResponse = async (
  request: APIRequestContext,
  { path, status }: CaseFileErrorResponseExpectation,
) => {
  const response = await request.get(`${UI_DOMAIN}${path}`, { maxRedirects: 0 });

  expect(response.status()).toBe(status);

  const headers = response.headers();

  expect(headers['content-type']).toContain('text/html');
  expect(headers['cache-control']).toBe('no-store');
  expect(headers['content-disposition']).toBeUndefined();
  expect(await response.text()).toMatch(new RegExp(`<html [^>]*data-status="${status}"`));
};

/** Opens the case file URL in the browser and verifies the error page, including Dekoratøren. */
export const verifyCaseFileErrorPage = async (
  page: Page,
  { lang, path, fileType, status }: CaseFileErrorPageExpectation,
) => {
  const response = await page.goto(`${UI_DOMAIN}${path}`);

  expect(response?.status()).toBe(status);
  expect(new URL(page.url()).pathname).toBe(path);
  await expect(page.locator('html')).toHaveAttribute('data-status', status.toString(10));

  const texts = CASE_FILE_ERROR_PAGE[lang];
  const { title, description } = texts[fileType][status];
  const main = page.locator('main');
  // Aksel buttons rendered as links have the button role.
  const minSideButton = main.getByRole('button', { name: texts.goToMinSide, exact: true });
  const tryAgainButton = main.getByRole('button', { name: texts.tryAgain, exact: true });

  await expect(main.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(main.getByText(description, { exact: true })).toBeVisible();
  await expect(minSideButton).toHaveAttribute('href', getMinSideUrl(lang));

  if (status === CaseFileErrorStatus.ERROR) {
    // Retrying is the main action for unexpected errors. It reloads the page, so the server fetches the file again.
    await expect(tryAgainButton).toHaveAttribute('href', path);
    await expect(tryAgainButton).toHaveAttribute('data-variant', 'primary');
    await expect(minSideButton).toHaveAttribute('data-variant', 'secondary');
  } else {
    await expect(tryAgainButton).toHaveCount(0);
    await expect(minSideButton).toHaveAttribute('data-variant', 'primary');
  }

  await expect(page).toHaveTitle(title);
  await expect(page.locator('#decorator-header')).toBeVisible();
  await expect(page.locator('#decorator-footer')).toBeVisible();
};
