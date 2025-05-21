import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

const API_KEY = process.env.WRITE_API_KEY;
const JOB_ID = process.env.JOB_ID ?? crypto.randomUUID();
const CREATE_URL = `https://klage-job-status.ekstern.dev.nav.no/jobs/${JOB_ID}`;
const UPDATE_URL = `${CREATE_URL}/status`;

enum Status {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

interface CreateJob {
  name?: string;
  timeout?: number;
}

const body = (name?: string, timeout?: number): CreateJob => ({
  name,
  timeout,
});

const NAME = 'Klang E2E tests';
const TIMEOUT = 15 * 60; // 15 minutes

const update = async (status: Status) => {
  if (JOB_ID === undefined || API_KEY === undefined) {
    return;
  }

  await fetch(UPDATE_URL, { method: 'PUT', headers: { API_KEY }, body: status });
};

class StatusReporter implements Reporter {
  async onBegin() {
    if (JOB_ID === undefined) {
      console.warn('JOB_ID is not set. Skipping status reporter.');
      return;
    }

    if (API_KEY === undefined) {
      console.warn('WRITE_API_KEY is not set. Skipping status reporter.');
      return;
    }

    await fetch(CREATE_URL, {
      method: 'POST',
      headers: {
        API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body(NAME, TIMEOUT)),
    });

    console.debug('Job status created', JOB_ID);
  }

  async onTestBegin() {
    await update(Status.RUNNING);
  }

  async onStepBegin() {
    await update(Status.RUNNING);
  }

  async onStepEnd(test: TestCase, result: TestResult) {
    await this.setStatusOnEnd(test, result);
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    await this.setStatusOnEnd(test, result);
  }

  async onEnd(result: FullResult) {
    if (result.status === 'passed') {
      return await update(Status.SUCCESS);
    }

    return await update(Status.FAILED);
  }

  private async setStatusOnEnd(test: TestCase, result: TestResult) {
    if (result.retry < test.retries) {
      // If it is retrying, we don't want to set the final status yet.
      return await update(Status.RUNNING);
    }

    if (result.status === 'failed') {
      return await update(Status.FAILED);
    }
  }
}

// biome-ignore lint/style/noDefaultExport: https://playwright.dev/docs/test-reporters
export default StatusReporter;
