import nodePath from 'node:path';
import {
  asyncForEach,
  delay,
  getFullStatusIcon,
  getTestStatusIcon,
  getTestTitle,
  SlackIcon,
} from '@app/reporters/functions';
import { getSlack, type SlackMessageThread } from '@app/slack/slack-client';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

interface TestSlackData {
  icon: SlackIcon;
  title: string;
  status: string;
  steps: Map<string, TestSlackData>;
}

class SlackReporter implements Reporter {
  private slack = getSlack();
  private mainThread: SlackMessageThread | null = null;
  private threads: Map<string, SlackMessageThread> = new Map();
  private testStatuses: Map<string, TestSlackData> = new Map();
  private tests: TestCase[] = [];
  private startTime = Date.now();
  private name = '';

  private async setTestMessage(test: TestCase, status: TestSlackData) {
    this.testStatuses.set(test.id, status);
    const existingTestThread = this.threads.get(test.id);

    if (existingTestThread !== undefined) {
      return await existingTestThread.update(formatTest(status));
    }

    if (this.slack === null) {
      if (process.env.NODE_ENV === 'test') {
        throw new Error('Cannot post message. No Slack client.');
      }

      return;
    }

    const testThread = await this.slack.postMessage(formatTest(status));
    this.threads.set(test.id, testThread);

    return testThread;
  }

  private async updateTestMessage(test: TestCase, status: Partial<Omit<TestSlackData, 'title'>>) {
    const previousStatus = this.testStatuses.get(test.id);

    if (previousStatus === undefined) {
      throw new Error('Cannot update message with no previous status.');
    }

    return await this.setTestMessage(test, { ...previousStatus, ...status });
  }

  private async updateMainMessage(msg: string) {
    const mainMessage = `*${this.name} - ${msg}*`;

    if (this.mainThread === null) {
      if (this.slack === null) {
        if (process.env.NODE_ENV === 'test') {
          throw new Error('Cannot post main message. No Slack client.');
        }

        return;
      }

      this.mainThread = await this.slack.postMessage(mainMessage);

      return this.mainThread;
    }

    this.mainThread = await this.mainThread?.update(mainMessage);

    return this.mainThread;
  }

  async onBegin(config: FullConfig, suite: Suite) {
    this.tests = suite.allTests();

    this.name = config.projects.map(({ name }) => name).join(', ');

    if (this.slack === null) {
      return;
    }

    await this.updateMainMessage(`Running ${this.tests.length} E2E tests with ${config.workers} workers...`);
  }

  async onTestBegin(test: TestCase) {
    const exiting = this.testStatuses.get(test.id);

    const isRetrying = test.results.some((r) => r.retry !== 0);

    await this.setTestMessage(test, {
      icon: SlackIcon.RUNNING,
      title: getTestTitle(test),
      status: isRetrying ? 'Retrying...' : 'Running...',
      steps: exiting?.steps ?? new Map<string, TestSlackData>(),
    });
  }

  async onStepBegin(test: TestCase, _result: TestResult, step: TestStep) {
    const status = this.testStatuses.get(test.id);

    if (status === undefined || step.category !== 'test.step') {
      return;
    }

    const isRetrying = test.results.some((r) => r.retry !== 0);

    status.steps.set(`${test.id}-${step.title}`, {
      title: step.title,
      icon: SlackIcon.RUNNING,
      status: isRetrying ? 'Retrying...' : 'Running...',
      steps: new Map(),
    });

    return await this.updateTestMessage(test, status);
  }

  async onStepEnd(test: TestCase, _result: TestResult, step: TestStep) {
    const testStatus = this.testStatuses.get(test.id);

    if (testStatus === undefined || !testStatus.steps.has(`${test.id}-${step.title}`)) {
      return;
    }

    testStatus.steps.set(`${test.id}-${step.title}`, {
      title: step.title,
      icon: step.error === undefined ? SlackIcon.SUCCESS : SlackIcon.WARNING,
      status: `${(step.duration / 1_000).toFixed(1)}s`,
      steps: new Map(),
    });

    return await this.updateTestMessage(test, testStatus);
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    const testThread = this.threads.get(test.id);
    const icon = getTestStatusIcon(test, result.status);
    const title = getTestTitle(test);
    this.updateTestMessage(test, { icon, status: `${(result.duration / 1_000).toFixed(1)}s` });

    const isFailed = result.status === 'failed' || result.status === 'timedOut';

    if (isFailed) {
      if (typeof result?.error?.stack === 'undefined') {
        const log = [`${title} - stacktrace`, '```', 'No stacktrace', '```'];
        await testThread?.reply(log.join('\n'));
      } else {
        const partLength = 3_000;

        const firstStack = result.error.stack.substring(0, partLength);
        const firstLog = [`${title} - stacktrace`, '```', firstStack, '```'];
        await testThread?.reply(firstLog.join('\n'));

        for (let i = 1; i * partLength < result.error.stack.length; i++) {
          const stack = result.error.stack.substring(i * partLength, (i + 1) * partLength);
          const log = ['```', stack, '```'];
          await testThread?.reply(log.join('\n'));
        }
      }
    }

    const atttachments = isFailed ? prepareFailedResult(result) : preparePassedResult(result);

    await asyncForEach(atttachments, async ({ name, path, body, contentType }) => {
      if (contentType === 'text/plain' && body instanceof Buffer) {
        return await testThread?.reply(
          [`${SlackIcon.WARNING} *Warning*`, '```', body.toString('utf-8'), '```'].join('\n'),
        );
      }

      if (path === undefined) {
        return;
      }

      const filename = name + nodePath.extname(path);

      if (name === 'trace') {
        return await testThread?.replyFilePath(
          path,
          `${title} - \`${name}\`\n\`npx playwright show-trace ${filename}\``,
          test.title,
          filename,
        );
      }

      return await testThread?.replyFilePath(path, `${title} - ${name}`, test.title, filename);
    });
  }

  async onEnd(result: FullResult) {
    const icon = getFullStatusIcon(result);
    const duration = (Date.now() - this.startTime) / 1_000;
    const tag = this.slack?.tagChannelOnError === 'true' ? '<!channel> ' : '';

    if (result.status === 'passed') {
      await this.updateMainMessage(`${icon} All ${this.tests.length} tests succeeded! \`${duration}s\``);
    } else if (result.status === 'failed') {
      await this.updateMainMessage(
        `${tag} ${icon} ${this.tests.filter((t) => !t.ok()).length} of ${this.tests.length} tests failed! \`${duration}s\``,
      );
    } else if (result.status === 'timedout') {
      await this.updateMainMessage(
        `${tag} ${icon} Global timeout! ${this.tests.filter((t) => !t.ok()).length} of ${this.tests.length} tests failed! \`${duration}s\``,
      );
    } else if (result.status === 'interrupted') {
      await this.updateMainMessage(
        `${tag} ${icon} Interrupted! ${this.tests.filter((t) => !t.ok()).length} of ${this.tests.length} tests failed! \`${duration}s\``,
      );
    }

    // Wait for all tests to be done sending to Slack.
    await delay(2_000);
  }
}

const ORDER = ['warningMessage', 'video', 'screenshot', 'trace'];

const prepareFailedResult = (result: TestResult) =>
  result.attachments.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));

const preparePassedResult = (result: TestResult) => result.attachments.filter(({ name }) => name === 'warningMessage');

const formatTest = ({ icon, status, title, steps }: TestSlackData): string => {
  if (steps.size === 0) {
    return `${icon} ${title} \`${status}\``;
  }

  return `${icon} ${title} \`${status}\`\n${formatSteps(Array.from(steps.values()))}`;
};

const formatSteps = (steps: TestSlackData[], level = 1): string => {
  const indent = '\t'.repeat(level);

  return steps
    .map((step) => {
      if (step.steps.size === 0) {
        return `${indent}${step.icon} ${step.title} \`${step.status}\``;
      }

      return `${indent}${step.icon} ${step.title} \`${step.status}\`\n${formatSteps(Array.from(steps.values()), level + 1)}`;
    })
    .join('\n');
};

export default SlackReporter;
