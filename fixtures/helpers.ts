import type { Locator, Page, Request } from '@playwright/test';

export const finishedRequest = async (requestPromise: Promise<Request>) => {
  const request = await requestPromise;
  const response = await request.response();

  if (response === null) {
    throw new Error('No response');
  }

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status()} - ${text}`);
  }

  return response.finished();
};

export const clearIfNotEmpty = async (page: Page, locator: Locator, apiUrl: string, loggedIn: boolean) => {
  if ((await locator.inputValue()) !== '') {
    const clearPromise = loggedIn ? page.waitForRequest(apiUrl) : null;

    await locator.clear();
    await locator.blur();

    if (clearPromise !== null) {
      await finishedRequest(clearPromise);
    }
  }
};

export const formatId = (idNumber: string) => `${idNumber.slice(0, 6)} ${idNumber.slice(6)}`;
