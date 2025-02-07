import { test as base } from '@playwright/test';
import { AnkePage } from './anke-page';
import { KabinPage } from './kabin-page';
import { KlagePage } from './klage-page';
import { OmgjøringskravPage } from './omgjøringskrav-page';
import { StatusPage } from './status-page';

interface Pages {
  kabinPage: KabinPage;
  klagePage: KlagePage;
  ankePage: AnkePage;
  omgjøringskravPage: OmgjøringskravPage;
  statusPage: StatusPage;
}

export const test = base.extend<Pages>({
  kabinPage: async ({ page }, use) => {
    await use(new KabinPage(page));
  },

  klagePage: async ({ page }, use) => {
    await use(new KlagePage(page));
  },

  ankePage: async ({ page }, use) => {
    await use(new AnkePage(page));
  },

  omgjøringskravPage: async ({ page }, use) => {
    await use(new OmgjøringskravPage(page));
  },

  statusPage: async ({ page }, use) => {
    await use(new StatusPage(page));
  },
});
