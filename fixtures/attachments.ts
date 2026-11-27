import { expect, type Locator, type Page } from '@playwright/test';
import { getAttachmentPath, type Language, verifyCaseFileLink } from '@/fixtures/case-files';

export interface TestAttachment {
  fileName: string;
}

/** The files uploaded by `BegrunnelsePage.uploadAttachments()`. */
export const TEST_ATTACHMENTS: TestAttachment[] = [
  { fileName: 'dummy.pdf' },
  { fileName: 'logo.png' },
  { fileName: 'logo.jpg' },
];

const ATTACHMENT_ID_REGEX = /\/vedlegg\/([^/]+)$/;

export const getAttachmentLink = (scope: Page | Locator, { fileName }: TestAttachment): Locator =>
  scope.getByRole('link', { name: fileName });

/** Verifies that the link points to the server route for the attachment and opens in a new tab. Returns the attachment ID. */
export const verifyAttachmentLink = async (link: Locator, lang: Language, caseId: string): Promise<string> => {
  const href = await link.getAttribute('href');

  if (href === null) {
    throw new Error('Attachment link has no href');
  }

  const match = href.match(ATTACHMENT_ID_REGEX);

  if (match === null) {
    throw new Error(`Attachment link has unexpected href: ${href}`);
  }

  const [, attachmentId] = match;

  expect(href).toBe(getAttachmentPath(lang, caseId, attachmentId));
  await verifyCaseFileLink(link, href);

  return attachmentId;
};
