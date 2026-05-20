import { KlangCase } from '@app/fixtures/registrering/klang-case';
import { test as base } from '@playwright/test';

interface Fixtures {
  klangCase: KlangCase;
}

export const test = base.extend<Fixtures>({
  klangCase: async ({ page, context }, use) => {
    await use(new KlangCase(page, context));
  },
});
