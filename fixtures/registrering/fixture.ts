import { KlangPage } from '@app/fixtures/registrering/klang-page';
import { test as base } from '@playwright/test';

interface Pages {
  klangPage: KlangPage;
}

export const test = base.extend<Pages>({
  klangPage: async ({ page, context }, use) => {
    await use(new KlangPage(page, context));
  },
});
