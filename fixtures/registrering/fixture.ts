import { test as base } from '@playwright/test';
import { KlangCase } from '@/fixtures/registrering/klang-case';

interface Fixtures {
  klangCase: KlangCase;
}

export const test = base.extend<Fixtures>({
  klangCase: async ({ page, context }, use) => {
    await use(new KlangCase(page, context));
  },
});
