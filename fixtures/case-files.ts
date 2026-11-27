import { type APIRequestContext, type BrowserContext, expect, type Locator, type Page } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';

export enum Language {
  NB = 'nb',
  NN = 'nn',
  EN = 'en',
}

// Case files (attachments and case PDFs) are served by the server route, which streams the file or shows an error page.

export const getAttachmentPath = (lang: Language, caseId: string, attachmentId: string): string =>
  `/${lang}/sak/${caseId}/vedlegg/${attachmentId}`;

/** The case PDF. After the case is sent in, this is the journalført PDF. */
export const getCasePdfPath = (lang: Language, caseId: string): string => `/${lang}/sak/${caseId}/pdf`;

/** The case PDF with a cover page, for sending in by post. */
export const getCaseInnsendingPdfPath = (lang: Language, caseId: string): string =>
  `/${lang}/sak/${caseId}/pdf/innsending`;

/** The API converts all uploaded attachments, including images, to PDF. */
const SERVED_CONTENT_TYPE = 'application/pdf';
const PDF_MAGIC_BYTES = '%PDF-';
const INLINE_DISPOSITION_REGEX = /^inline\b/;

/** Verifies that the link points to the expected server route and opens in a new tab. */
export const verifyCaseFileLink = async (link: Locator, path: string) => {
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', path);
};

/** Clicks the link and verifies that the file is served in a new tab. */
export const openCaseFileInNewTab = async (page: Page, context: BrowserContext, link: Locator) => {
  const href = await link.getAttribute('href');

  if (href === null) {
    throw new Error('Case file link has no href');
  }

  const url = `${UI_DOMAIN}${href}`;
  const pagePromise = context.waitForEvent('page');
  // Listen on the context, as the response belongs to the new tab, which may not exist yet.
  const responsePromise = context.waitForEvent('response', (response) => response.url() === url);

  await link.click();

  const [newTab, response] = await Promise.all([pagePromise, responsePromise]);

  expect(newTab).not.toBe(page);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe(SERVED_CONTENT_TYPE);

  await newTab.close();
};

/** Verifies that the server streams the file inline, as a PDF. */
export const verifyCaseFile = async (request: APIRequestContext, path: string) => {
  const response = await request.get(`${UI_DOMAIN}${path}`, { maxRedirects: 0 });

  expect(response.status()).toBe(200);

  const headers = response.headers();

  expect(headers['content-type']).toBe(SERVED_CONTENT_TYPE);
  expect(headers['content-disposition']).toMatch(INLINE_DISPOSITION_REGEX);
  expect(headers['x-content-type-options']).toBe('nosniff');

  const body = await response.body();

  expect(body.subarray(0, PDF_MAGIC_BYTES.length).toString('latin1')).toBe(PDF_MAGIC_BYTES);
};
