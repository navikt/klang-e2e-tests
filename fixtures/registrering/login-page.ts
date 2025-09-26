import { UI_DOMAIN } from '@app/config/env';
import { formatId } from '@app/fixtures/helpers';
import { testUser, type User } from '@app/testdata/user';
import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(public readonly page: Page) {}

  logIn = (path?: string) => logIn(this.page, testUser.id, path);

  verifyLogin = () => verifyLogin(this.page, testUser);
}

export const logIn = async (page: Page, id: string, path?: string) => {
  if (path !== undefined) {
    await page.goto(`${UI_DOMAIN}/${path}`);
  }

  await page.getByText('Logg inn', { exact: true }).click();
  await page.getByText('TestID på nivå høyt').click();
  await page.getByLabel('Personidentifikator (syntetisk)').fill(id);
  await page.getByText('Autentiser').click();
  await page.waitForURL(`${UI_DOMAIN}/nb/sak/**`);
};

export const verifyLogin = async (page: Page, { id, firstName, lastName }: User) => {
  const firstNameHeading = page.getByRole('heading', { name: 'For- og mellomnavn' });
  await firstNameHeading.waitFor({ timeout: 3000 });
  const lastNameHeading = page.getByRole('heading', { name: 'Etternavn' });
  const idNumberHeading = page.getByRole('heading', { name: 'Fødselsnummer, D-nummer eller NPID' });

  expect(page.locator('section').filter({ has: firstNameHeading })).toContainText(firstName);
  expect(page.locator('section').filter({ has: lastNameHeading })).toContainText(lastName);
  expect(page.locator('section').filter({ has: idNumberHeading })).toContainText(formatId(id));
};
