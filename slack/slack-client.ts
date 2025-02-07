import fs, { type ReadStream, createReadStream } from 'node:fs';
import { buffer } from 'node:stream/consumers';
import { App, isCodedError } from '@slack/bolt';
import type { ChatPostMessageResponse, ChatUpdateResponse } from '@slack/web-api';
import { IS_DEPLOYED, envString, requiredEnvString } from '../config/env';

const BOT_NAME = 'Kabin E2E';
const ICON_URL = 'https://raw.githubusercontent.com/navikt/kabin/main/frontend/assets/android-chrome-192x192.png';

class SlackClient {
  private app: App;

  constructor(
    private token: string,
    private channel: string,
    signingSecret: string,
    public tagChannelOnError: string,
  ) {
    this.app = new App({ token, signingSecret });
  }

  async postMessage(message: string) {
    const response = await this.app.client.chat.postMessage({
      token: this.token,
      channel: this.channel,
      text: message,
      username: BOT_NAME,
      icon_url: ICON_URL,
    });

    return new SlackMessageThread(this, response);
  }

  async uploadFile(
    filePath: string,
    filename: string = filePath,
    title: string = filePath,
    message?: string,
    threadMessage?: ChatPostMessageResponse | ChatUpdateResponse,
  ) {
    return await this.uploadFileBuffer(createReadStream(filePath), filename, title, message, threadMessage);
  }

  async uploadFileBuffer(
    fileBuffer: Buffer | ReadStream,
    filename?: string,
    title?: string,
    message?: string,
    threadMessage?: ChatPostMessageResponse | ChatUpdateResponse,
  ) {
    try {
      const channel_id = threadMessage?.channel ?? this.channel;
      const thread_ts = threadMessage?.ts;

      const params = { token: this.token, file: fileBuffer, filename, channel_id, title, initial_comment: message };

      return await this.app.client.files.uploadV2(thread_ts === undefined ? params : { ...params, thread_ts });
    } catch (error) {
      const bufferSize = Buffer.isBuffer(fileBuffer) ? fileBuffer.byteLength : (await buffer(fileBuffer)).byteLength;
      const errorMessage = `Failed to upload file (${bufferSize} bytes): ${filename ?? '<no filename>'}`;

      console.error(errorMessage);

      if (typeof threadMessage !== 'undefined') {
        this.postReply(threadMessage, errorMessage);
      } else {
        this.postMessage(errorMessage);
      }

      throw error;
    }
  }

  async updateMessage(message: ChatPostMessageResponse | ChatUpdateResponse, newMessage: string) {
    if (typeof message.ts === 'undefined') {
      throw new Error('Could not update message.');
    }

    try {
      const response = await this.app.client.chat.update({
        token: this.token,
        channel: message?.channel ?? this.channel,
        ts: message.ts,
        text: newMessage,
      });

      return new SlackMessageThread(this, response);
    } catch (error) {
      if (isCodedError(error)) {
        console.error('Failed to update message with', error.code, newMessage.length);
      }
      this.postReply(message, ['Failed to update Slack message to:', '```', newMessage, '```'].join('\n'));
      throw error;
    }
  }

  async postReply(threadMessage: ChatPostMessageResponse | ChatUpdateResponse, reply: string) {
    if (typeof threadMessage.ts === 'undefined') {
      throw new Error('Could not reply to message.');
    }

    await this.app.client.chat.postMessage({
      token: this.token,
      channel: threadMessage?.channel ?? this.channel,
      thread_ts: threadMessage.ts,
      text: reply,
    });

    return threadMessage;
  }
}

export const getSlack = () => {
  const token = envString('slack_e2e_token', IS_DEPLOYED);
  const channel = envString('klage_notifications_channel', IS_DEPLOYED);
  const secret = envString('slack_signing_secret', IS_DEPLOYED);
  const tagChannelOnError = requiredEnvString('tag_channel_on_error', 'true');

  if (
    typeof token === 'string' &&
    typeof channel === 'string' &&
    typeof secret === 'string' &&
    typeof tagChannelOnError === 'string'
  ) {
    return new SlackClient(token, channel, secret, tagChannelOnError);
  }

  console.warn(
    'Could not create slack client. Missing env variables: slack_e2e_token, klage_notifications_channel, slack_signing_secret',
  );

  return null;
};

export class SlackMessageThread {
  constructor(
    private app: SlackClient,
    private message: ChatPostMessageResponse | ChatUpdateResponse,
  ) {
    /* Empty */
  }

  update = (newMessage: string) => this.app.updateMessage(this.message, newMessage);

  reply = (reply: string) => this.app.postReply(this.message, reply);

  replyFilePath = (filePath: string, reply?: string, title?: string, filename?: string) => {
    // https://github.com/microsoft/playwright/issues/12711
    if (fs.existsSync(filePath)) {
      return this.app.uploadFile(filePath, filename, title, reply, this.message);
    }

    console.error(`Tried to upload file ${filePath ?? ''}, but it did not exist.`);
  };

  replyFileBuffer = (file: Buffer, reply?: string, title?: string, filename?: string) =>
    this.app.uploadFileBuffer(file, filename, title, reply, this.message);
}
