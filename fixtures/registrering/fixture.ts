import { test as base } from '@playwright/test';
import { KlangPage } from './klang-page';
import { LoginPage } from './login-page';

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
