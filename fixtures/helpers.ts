import type { Page, Request } from '@playwright/test';
import { makeDirectApiRequest } from '../fixtures/direct-api-request';

const feilRegistrer = async (page: Page, kabalId: string) => {
  const res = await makeDirectApiRequest(page, 'kabal-api', `/behandlinger/${kabalId}/feilregistrer`, 'POST', {
    reason: 'E2E-test',
  });

  if (res.ok) {
    console.debug(`Feilregistrert oppgave with id: ${kabalId}`);
  } else {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
};

const deleteOppgave = async (page: Page, kabalId: string) => {
  const res = await makeDirectApiRequest(page, 'kabal-api', `/internal/behandlinger/${kabalId}`, 'DELETE');

  if (res.ok) {
    console.debug(`Deleted oppgave with id: ${kabalId}`);
  } else {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
};

const exponentialBackoff = <T>(
  promise: () => Promise<T>,
  label: string,
  retries: number,
  delay = 1000,
  factor = 2,
): Promise<T> =>
  promise().catch((error) => {
    if (retries === 0) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.debug(`${label} failed: ${errorMessage}. Retrying in ${delay}ms... Remaining retries: ${retries}`);

    return new Promise<T>((resolve) =>
      setTimeout(() => resolve(exponentialBackoff(promise, label, retries - 1, delay * factor, factor)), delay),
    );
  });

export const feilregistrerAndDelete = async (page: Page, kabalId: string) => {
  try {
    await exponentialBackoff(() => feilRegistrer(page, kabalId), 'Feilregistrering', 3, 1000, 2);
  } catch (e) {
    console.error('Feilregistrering failed for oppgave:', kabalId, e);
  }

  try {
    await exponentialBackoff(() => deleteOppgave(page, kabalId), 'Deletion', 3, 1000, 2);
  } catch (e) {
    console.error('Delete failed for oppgave:', kabalId, e);
  }
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const REGISTRERING = `http(?:s?)://(?:.+)/registrering/(${UUID})`;
export const REGISTRERING_REGEX = new RegExp(`${REGISTRERING}`);
export const STATUS_REGEX = new RegExp(`${REGISTRERING}/status`);

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
