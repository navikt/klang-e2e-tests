import { format } from 'date-fns';
import { test } from '../../fixtures/registrering/fixture';
import { type Part, Sakstype, Utskriftstype } from '../../fixtures/registrering/types';
import { UI_DOMAIN } from '../functions';
import { ANKE, KLAGE, OMGJØRINGSKRAV, data } from './testdata';

test.describe('Registrering', () => {
  test.beforeEach(({ page }) => page.goto(UI_DOMAIN));

  test.afterEach(async ({ kabinPage }, { status }) => {
    if (status !== 'passed') {
      await kabinPage.deleteRegistrering();
    }
  });

  for (const {
    type,
    sakenGjelder,
    getJournalpostParams,
    hjemlerLong,
    hjemlerShort,
    mottattKlageinstans,
    tildeltSaksbehandler,
    gosysOppgave,
  } of [KLAGE, ANKE, OMGJØRINGSKRAV]) {
    test(`${type}`, async ({ kabinPage, statusPage, klagePage }) => {
      await kabinPage.setSakenGjelder(sakenGjelder);

      const jpData = await kabinPage.selectJournalpostByInnerText(getJournalpostParams);
      await kabinPage.selectType(type);

      const vedtak = await kabinPage.selectFirstAvailableVedtak(type);

      const { fagsakId } = vedtak.data;

      await klagePage.setGosysOppgave(gosysOppgave);

      await kabinPage.verifySaksId(jpData.saksId, fagsakId);

      const ytelse = await kabinPage.getYtelse();

      if (type === Sakstype.KLAGE) {
        await klagePage.setMottattVedtaksinstans(jpData.dato);
      }

      await kabinPage.setMottattKlageinstans(mottattKlageinstans);

      await kabinPage.setFristIKabal(data.fristIKabal, mottattKlageinstans);
      await kabinPage.setHjemler(hjemlerLong, hjemlerShort);

      await kabinPage.verifySakenGjelder(sakenGjelder);
      await kabinPage.setAnkendePart(data.ankendePart);
      await kabinPage.setFullmektig(data.fullmektig);

      if (jpData.type === 'I') {
        await kabinPage.setAvsender(data.avsender);
      }

      await kabinPage.setSaksbehandler(tildeltSaksbehandler);

      await kabinPage.setSendSvarbrev(true);
      await kabinPage.setSvarbrevDocumentName(data.svarbrevName);
      await kabinPage.setSvarbrevFullmektigName(data.svarbrevFullmektigNamae);
      await kabinPage.setSvarbrevVarsletFrist(data.varsletFrist);
      await kabinPage.setSvarbrevFritekst('E2E-fritekst');

      await kabinPage.selectMottaker(sakenGjelder);
      await kabinPage.selectMottaker(data.ankendePart);
      await kabinPage.selectMottaker(data.fullmektig);

      await kabinPage.setUtskriftTypeForPart(data.ankendePart, Utskriftstype.LOKAL);

      await kabinPage.changeAddressForPart(
        sakenGjelder,
        data.sakenGjelderAddress1,
        data.sakenGjelderAddress2,
        data.sakenGjelderAddress3,
        { search: 'sandwich', fullName: data.sakenGjelderLand },
      );

      await kabinPage.addExtraReceiver(data.ekstraMottaker1);
      await kabinPage.addExtraReceiver(data.ekstraMottaker2);
      await kabinPage.addExtraReceiver(data.ekstraMottaker3);
      await kabinPage.setUtskriftTypeForExtraReceiver(data.ekstraMottaker1, Utskriftstype.LOKAL);
      await kabinPage.changeAddressForExtraReceiver(
        data.ekstraMottaker2,
        data.ekstraMottakerAddress1,
        data.ekstraMottakerAddress2,
        data.ekstraMottakerAddress3,
        { search: 'mcdonald', fullName: data.ekstraMottakerLand },
      );

      await kabinPage.finish(type);

      await statusPage.verifyJournalførtDocument(
        {
          title: jpData.title,
          tema: vedtak.data.tema,
          dato: jpData.saksId === fagsakId ? jpData.dato : format(new Date(), 'dd.MM.yyyy'),
          avsenderMottaker: getAvsenderName(jpData.type, jpData.avsenderMottaker, data.avsender),
          saksId: fagsakId,
          type: jpData.type,
          logiskeVedleggNames: jpData.logiskeVedleggNames,
          vedleggNames: jpData.vedleggNames,
        },
        type,
      );

      await statusPage.verifySaksinfo(
        {
          mottattKlageinstans,
          fristIKabal: data.fristIKabal.getDateAndExtension(mottattKlageinstans),
          varsletFrist: data.varsletFrist.getDateAndExtension(mottattKlageinstans),
          klager: data.ankendePart,
          fullmektig: data.fullmektig,
          saksbehandlerName: tildeltSaksbehandler,
        },
        type,
      );

      const sakenGjelderAddress = `${data.sakenGjelderAddress1}, ${data.sakenGjelderAddress2}, ${data.sakenGjelderAddress3}, ${data.sakenGjelderLand}`;
      const extraMottakerAddress = `${data.ekstraMottakerAddress1}, ${data.ekstraMottakerAddress2}, ${data.ekstraMottakerAddress3}, ${data.ekstraMottakerLand}`;
      await statusPage.verifySvarbrevinfo({
        documentName: data.svarbrevName,
        mottakere: [
          { name: sakenGjelder.name, utskrift: 'Sentral utskrift', address: sakenGjelderAddress },
          { name: data.ankendePart.name, utskrift: 'Lokal utskrift' },
          { name: data.fullmektig.name, utskrift: 'Sentral utskrift' },
          { name: data.ekstraMottaker1.name, utskrift: 'Lokal utskrift' },
          { name: data.ekstraMottaker2.name, utskrift: 'Sentral utskrift', address: extraMottakerAddress },
          { name: data.ekstraMottaker3.name, utskrift: 'Sentral utskrift' },
        ],
      });

      // const ytelse = vedtak.type === Sakstype.ANKE ? vedtak.data.ytelse : undefined;

      const { vedtaksdato, fagsystem } = vedtak.data;

      await statusPage.verifyValgtVedtak({ sakenGjelder, vedtaksdato, fagsystem, saksId: fagsakId, ytelse }, type);
    });
  }
});

const getAvsenderName = (journalpostType: string, journalpostAvsenderMottaker: string, testDataAvsender: Part) => {
  switch (journalpostType) {
    case 'N':
      return 'Ingen';
    case 'I':
      return testDataAvsender.getNameAndId();
    case 'U':
      return journalpostAvsenderMottaker;
    default:
      throw new Error(`Unknown journalpostType: ${journalpostType}`);
  }
};
