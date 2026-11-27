import { UI_DOMAIN } from '@/config/env';
import { getAttachmentLink, TEST_ATTACHMENTS, verifyAttachmentLink } from '@/fixtures/attachments';
import {
  CaseFileErrorStatus,
  CaseFileType,
  verifyCaseFileErrorPage,
  verifyCaseFileErrorResponse,
} from '@/fixtures/case-file-error-page';
import {
  getAttachmentPath,
  getCaseInnsendingPdfPath,
  getCasePdfPath,
  Language,
  openCaseFileInNewTab,
  verifyCaseFile,
} from '@/fixtures/case-files';
import { Innsendingsytelse } from '@/fixtures/innsendingsytelse';
import { test } from '@/fixtures/registrering/fixture';
import { Type } from '@/fixtures/registrering/shared-state';

/** Valid format, but does not belong to any attachment. */
const NON_EXISTING_ATTACHMENT_ID = '00000000-0000-0000-0000-000000000000';
/** Rejected by the server without asking the API. */
const INVALID_ID = 'ugyldig.id';
/** Passes the server's validation, but the API rejects it, which is unexpected. */
const MALFORMED_ATTACHMENT_ID = 'abc';

const LANGUAGES = [Language.NB, Language.NN, Language.EN];

test.describe('Saksfiler', () => {
  test.slow();

  test('vedlegg åpnes i ny fane, og ugyldige, slettede eller ukjente vedlegg gir feilside', async ({
    klangCase,
    page,
    context,
  }) => {
    const attachmentIds = new Map<string, string>();

    await test.step('Create case and upload attachments', async () => {
      await klangCase.createLoggedInCase(Type.Klage, Innsendingsytelse.GRUNNSTONAD);
      await klangCase.begrunnelse.uploadAttachments();
    });

    const caseId = klangCase.getCaseId();

    await test.step('Open attachments from begrunnelse', async () => {
      for (const attachment of TEST_ATTACHMENTS) {
        const link = getAttachmentLink(page.locator('main'), attachment);
        const attachmentId = await verifyAttachmentLink(link, Language.NB, caseId);
        attachmentIds.set(attachment.fileName, attachmentId);

        await openCaseFileInNewTab(page, context, link);
        await verifyCaseFile(page.request, getAttachmentPath(Language.NB, caseId, attachmentId));
      }
    });

    await test.step('Invalid attachment ID gives 404', async () => {
      const path = getAttachmentPath(Language.NB, caseId, INVALID_ID);
      const status = CaseFileErrorStatus.NOT_FOUND;

      await verifyCaseFileErrorResponse(page.request, { path, status });
      await verifyCaseFileErrorPage(page, { lang: Language.NB, path, fileType: CaseFileType.ATTACHMENT, status });
    });

    await test.step('Invalid case ID for the case PDF gives 404', async () => {
      for (const lang of LANGUAGES) {
        const path = getCasePdfPath(lang, INVALID_ID);
        const status = CaseFileErrorStatus.NOT_FOUND;

        await verifyCaseFileErrorResponse(page.request, { path, status });
        await verifyCaseFileErrorPage(page, { lang, path, fileType: CaseFileType.PDF, status });
      }
    });

    await test.step('Unexpected API response gives 502 with retry', async () => {
      for (const lang of LANGUAGES) {
        const path = getAttachmentPath(lang, caseId, MALFORMED_ATTACHMENT_ID);
        const status = CaseFileErrorStatus.ERROR;

        await verifyCaseFileErrorResponse(page.request, { path, status });
        await verifyCaseFileErrorPage(page, { lang, path, fileType: CaseFileType.ATTACHMENT, status });
      }
    });

    await test.step('Attachment deleted by the user gives 404', async () => {
      const [, deleted] = TEST_ATTACHMENTS;
      const attachmentId = attachmentIds.get(deleted.fileName);

      if (attachmentId === undefined) {
        throw new Error(`Missing attachment ID for ${deleted.fileName}`);
      }

      await page.goto(`${UI_DOMAIN}/nb/sak/${caseId}/begrunnelse`);
      await klangCase.begrunnelse.deleteAttachment(deleted.fileName);

      const path = getAttachmentPath(Language.NB, caseId, attachmentId);
      const status = CaseFileErrorStatus.NOT_FOUND;

      await verifyCaseFileErrorResponse(page.request, { path, status });
      await verifyCaseFileErrorPage(page, { lang: Language.NB, path, fileType: CaseFileType.ATTACHMENT, status });
    });

    await test.step('Manipulated attachment ID gives 404', async () => {
      for (const lang of LANGUAGES) {
        const path = getAttachmentPath(lang, caseId, NON_EXISTING_ATTACHMENT_ID);
        const status = CaseFileErrorStatus.NOT_FOUND;

        await verifyCaseFileErrorResponse(page.request, { path, status });
        await verifyCaseFileErrorPage(page, { lang, path, fileType: CaseFileType.ATTACHMENT, status });
      }
    });
  });

  test('vedlegg og PDF-er gir 404 når saken er slettet før innsending', async ({ klangCase, page }) => {
    await test.step('Create case and upload attachments', async () => {
      await klangCase.createLoggedInCase(Type.Klage, Innsendingsytelse.GRUNNSTONAD);
      await klangCase.begrunnelse.uploadAttachments();
    });

    const caseId = klangCase.getCaseId();
    const [attachment] = TEST_ATTACHMENTS;
    const attachmentId = await verifyAttachmentLink(
      getAttachmentLink(page.locator('main'), attachment),
      Language.NB,
      caseId,
    );

    await test.step('Delete case', async () => {
      await klangCase.deleteCase();
    });

    await test.step('Attachments and PDFs of a deleted case give 404', async () => {
      const status = CaseFileErrorStatus.NOT_FOUND;

      for (const lang of LANGUAGES) {
        const files = [
          { path: getAttachmentPath(lang, caseId, attachmentId), fileType: CaseFileType.ATTACHMENT },
          { path: getCasePdfPath(lang, caseId), fileType: CaseFileType.PDF },
          { path: getCaseInnsendingPdfPath(lang, caseId), fileType: CaseFileType.PDF },
        ];

        for (const { path, fileType } of files) {
          await verifyCaseFileErrorResponse(page.request, { path, status });
          await verifyCaseFileErrorPage(page, { lang, path, fileType, status });
        }
      }
    });
  });

  test('vedlegg og PDF-er åpnes fra oppsummering og kvittering, og gir 410 etter innsending', async ({
    klangCase,
    page,
    context,
  }) => {
    const attachmentIds: string[] = [];

    await test.step('Create case and upload attachments', async () => {
      await klangCase.createLoggedInCase(Type.Klage, Innsendingsytelse.HJELPESTONAD);
      await klangCase.begrunnelse.insertVedtaksdato('01.02.2025');
      await klangCase.begrunnelse.insertSaksnummer('1337');
      await klangCase.begrunnelse.insertBegrunnelse('Fordi jeg ikke er enig');
      await klangCase.begrunnelse.uploadAttachments();
      await klangCase.begrunnelse.submit();
    });

    const caseId = klangCase.getCaseId();

    await test.step('Open attachments from oppsummering', async () => {
      await klangCase.oppsummering.verify();

      for (const attachment of TEST_ATTACHMENTS) {
        const link = getAttachmentLink(page.locator('main'), attachment);
        const attachmentId = await verifyAttachmentLink(link, Language.NB, caseId);
        attachmentIds.push(attachmentId);

        await openCaseFileInNewTab(page, context, link);
        await verifyCaseFile(page.request, getAttachmentPath(Language.NB, caseId, attachmentId));
      }
    });

    await test.step('Open PDF for sending by post from oppsummering', async () => {
      await klangCase.oppsummering.openInnsendingPdf(context, caseId);
      await verifyCaseFile(page.request, getCaseInnsendingPdfPath(Language.NB, caseId));
      await page.goBack();
    });

    await test.step('Send in case', async () => {
      await klangCase.oppsummering.sendInn();
      await klangCase.kvittering.verify();
    });

    await test.step('Open case PDF from kvittering', async () => {
      await klangCase.kvittering.downloadPdf();
      await verifyCaseFile(page.request, getCasePdfPath(Language.NB, caseId));
    });

    await test.step('Attachments of a sent case give 410', async () => {
      for (const attachmentId of attachmentIds) {
        const path = getAttachmentPath(Language.NB, caseId, attachmentId);
        const status = CaseFileErrorStatus.GONE;

        await verifyCaseFileErrorResponse(page.request, { path, status });
        await verifyCaseFileErrorPage(page, { lang: Language.NB, path, fileType: CaseFileType.ATTACHMENT, status });
      }

      const [attachmentId] = attachmentIds;

      if (attachmentId === undefined) {
        throw new Error('Missing attachment IDs');
      }

      for (const lang of [Language.NN, Language.EN]) {
        const path = getAttachmentPath(lang, caseId, attachmentId);
        const status = CaseFileErrorStatus.GONE;

        await verifyCaseFileErrorPage(page, { lang, path, fileType: CaseFileType.ATTACHMENT, status });
      }
    });

    await test.step('PDF for sending by post of a sent case is still available', async () => {
      for (const lang of LANGUAGES) {
        await verifyCaseFile(page.request, getCaseInnsendingPdfPath(lang, caseId));
      }
    });
  });
});
