import { KlangPage } from '@app/fixtures/registrering/klang-page';
import { LoginPage } from '@app/fixtures/registrering/login-page';
import { test as base } from '@playwright/test';

interface Pages {
  klangPage: KlangPage;
  loginPage: LoginPage;
}

export const test = base.extend<Pages>({
  klangPage: async ({ page, context }, use) => {
    await use(new KlangPage(page, context));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});
