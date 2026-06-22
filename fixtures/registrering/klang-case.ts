import type { BrowserContext, Page } from '@playwright/test';
import { UI_DOMAIN } from '@/config/env';
import { dismissConsentBanner } from '@/fixtures/consent';
import { finishedRequest } from '@/fixtures/helpers';
import type { Innsendingsytelse } from '@/fixtures/innsendingsytelse';
import { BegrunnelsePage } from '@/fixtures/registrering/begrunnelse';
import { KvitteringPage } from '@/fixtures/registrering/kvittering';
import { checkLoggedIn, logIn } from '@/fixtures/registrering/login';
import { OppsummeringPage } from '@/fixtures/registrering/oppsummering';
import {
  createSharedState,
  LOGGED_IN_SAK_REGEX,
  type SharedState,
  Type,
  toQueryParams,
} from '@/fixtures/registrering/shared-state';
import { TEST_USER } from '@/testdata/user';

export class KlangCase {
  readonly begrunnelse: BegrunnelsePage;
  readonly oppsummering: OppsummeringPage;
  readonly kvittering: KvitteringPage;

  #state: SharedState;

  constructor(
    private page: Page,
    context: BrowserContext,
  ) {
    this.#state = createSharedState();
    this.begrunnelse = new BegrunnelsePage(page, this.#state);
    this.oppsummering = new OppsummeringPage(page, this.#state);
    this.kvittering = new KvitteringPage(page, context, this.#state);
    dismissConsentBanner(page, context);
  }

  async setDeepLinkParams(internalSaksnummer: string, harMottattBrev: boolean) {
    const loggedInCasePath = LOGGED_IN_SAK_REGEX.test(this.page.url());

    if (loggedInCasePath) {
      throw new Error('Cannot change deep link params for a logged-in case. Create a new case to change params.');
    }

    this.#state.internalSaksnummer = internalSaksnummer;
    this.#state.harMottattBrev = harMottattBrev;

    const params = toQueryParams({
      saksnummer: internalSaksnummer,
      ka: harMottattBrev,
    });

    await this.#navigateAndWaitForAppRender(
      `${UI_DOMAIN}/nb/${this.#state.type}/${this.#state.ytelse}?${params}`,
      `${UI_DOMAIN}/nb/${this.#state.type}/${this.#state.ytelse}/begrunnelse`,
    );
  }

  async createLoggedOutCase(
    type: Type,
    ytelse: Innsendingsytelse,
    saksnummer: string | null = null,
    ka: boolean | null = null,
  ) {
    this.#state.ytelse = ytelse;
    this.#state.type = type;
    this.#state.internalSaksnummer = saksnummer;
    this.#state.harMottattBrev = ka;

    const params = toQueryParams({ saksnummer, ka });

    await this.page.goto(`${UI_DOMAIN}/nb/${type}/${ytelse}?${params}`);
    await this.page.waitForURL(`${UI_DOMAIN}/nb/${type}/${ytelse}/begrunnelse`);
  }

  async createLoggedInCase(
    type: Type,
    ytelse: Innsendingsytelse,
    saksnummer: string | null = null,
    harMottattBrev: boolean | null = null,
  ) {
    this.#state.type = type;
    this.#state.ytelse = ytelse;
    this.#state.internalSaksnummer = saksnummer;
    this.#state.harMottattBrev = harMottattBrev;
    this.#state.idNumber = TEST_USER.id;
    this.#state.firstName = TEST_USER.firstName;
    this.#state.lastName = TEST_USER.lastName;

    await this.#ensureNewLoggedInCase();
  }

  async logIn() {
    await logIn(this.page, TEST_USER.id);

    // Wait for the app to transition to the logged-in begrunnelse view.
    // Dev server under parallel load may fail to serve the JS bundle,
    // so we retry with reloads — short wait, more attempts.
    const personalInfoSection = this.page
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: 'For- og mellomnavn' }) });

    const MAX_RELOADS = 5;

    for (let attempt = 1; attempt <= MAX_RELOADS; attempt++) {
      try {
        await personalInfoSection.waitFor({ timeout: 5_000 });
        break;
      } catch {
        if (attempt === MAX_RELOADS) {
          throw new Error(
            `Personal info section not visible after login + ${MAX_RELOADS} reload attempts. Current URL: ${this.page.url()}`,
          );
        }

        await this.page.reload({ waitUntil: 'commit' });
      }
    }

    this.#state.idNumber = TEST_USER.id;
    this.#state.firstName = TEST_USER.firstName;
    this.#state.lastName = TEST_USER.lastName;

    await this.begrunnelse.verifyPersonalInfo();
    await this.begrunnelse.verifySaksnummer();
  }

  async deleteCase() {
    const loggedInCasePath = LOGGED_IN_SAK_REGEX.test(this.page.url());

    if (loggedInCasePath) {
      await this.#deleteLoggedInCase();
    } else {
      await this.#deleteLoggedOutCase();
    }
  }

  async #deleteLoggedOutCase() {
    const loggedInCasePath = LOGGED_IN_SAK_REGEX.test(this.page.url());

    if (loggedInCasePath) {
      throw new Error('Expected to be on a logged-out case, but URL indicates a logged-in case');
    }

    if (await checkLoggedIn(this.page)) {
      throw new Error('Expected to be logged out when deleting case, but was logged in');
    }

    await this.#clickDeleteCase();
  }

  async #deleteLoggedInCase() {
    const urlMatch = this.page.url().match(LOGGED_IN_SAK_REGEX);

    if (urlMatch === null) {
      throw new Error('Could not find case UUID');
    }

    const [_, uuid] = urlMatch;

    const requestPromise = this.page.waitForRequest(
      (request) => request.url().endsWith(`/klanker/${uuid}`) && request.method() === 'DELETE',
    );

    await this.#clickDeleteCase();
    await finishedRequest(requestPromise);
  }

  async #clickDeleteCase() {
    if (this.#state.type === Type.Klage) {
      await this.page.getByTitle('Slett klagen og returner til hovedsiden').click();
    } else if (this.#state.type === Type.Anke) {
      await this.page.getByTitle('Slett anken og returner til hovedsiden').click();
    } else if (this.#state.type === Type.Klageettersendelse || this.#state.type === Type.Ankeettersendelse) {
      await this.page.getByTitle('Slett ettersendelsen og returner til hovedsiden').click();
    }

    await this.page.getByTitle('Bekreft sletting').click();
  }

  async #ensureNewLoggedInCase() {
    const params = toQueryParams({
      saksnummer: this.#state.internalSaksnummer,
      ka: this.#state.harMottattBrev,
    });

    await this.#createLoggedInCase(params);
    await this.#deleteLoggedInCase();
    await this.#createLoggedInCase(params);
  }

  async #createLoggedInCase(params: string) {
    await this.#navigateAndWaitForAppRender(
      `${UI_DOMAIN}/nb/${this.#state.type}/${this.#state.ytelse}?${params}`,
      `${UI_DOMAIN}/nb/sak/**/begrunnelse`,
    );
  }

  async #navigateAndWaitForAppRender(gotoUrl: string, expectedUrlPattern: string) {
    const MAX_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.page.goto(gotoUrl, { waitUntil: 'commit' });
        await this.page.waitForURL(expectedUrlPattern, { timeout: 5_000 });
        await this.page.locator('main').waitFor({ timeout: 5_000 });
        return;
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `Navigation to ${expectedUrlPattern} failed after ${MAX_ATTEMPTS} attempts. Current URL: ${this.page.url()}`,
          );
        }
      }
    }
  }
}
