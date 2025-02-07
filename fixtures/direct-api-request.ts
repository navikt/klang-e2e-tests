import type { Page } from '@playwright/test';
import { createApiUrl } from '../tests/functions';

export const makeDirectApiRequest = async <T>(
  page: Page,
  api: 'kabin-api' | 'kabal-api' | 'kabal-innstillinger',
  path: string,
  method: 'POST' | 'GET' | 'PUT' | 'DELETE',
  body?: T,
) => {
  const url = createApiUrl(api, path);

  try {
    return fetch(url, {
      method,
      body: JSON.stringify(body),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: (await page.context().cookies()).map(({ name, value }) => `${name}=${value}`).join('; '),
      },
    });
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`${method} ${url} - ${e.message}.`);
    }

    throw new Error(`${method} ${url} - Unkown error.`);
  }
};
