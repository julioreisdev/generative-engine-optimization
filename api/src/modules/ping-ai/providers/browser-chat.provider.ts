import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { closeOnAbort } from '../../../common/close-on-abort.js';
import { pingAiConfig } from '../../../config/ping-ai.config.js';
import {
  BROWSER_SESSION_FACTORY,
  type BrowserSessionFactory,
} from '../../browser/browser-session.interface.js';
import {
  AskOptions,
  PreparableChatProvider,
  PreparedChat,
} from './ai-chat-provider.interface.js';
import { BrowserChat } from './browser-chat.js';

export interface ChatSelectors {
  input: string;
  send: string;
  response: string;
  busy: string;
}

@Injectable()
export abstract class BrowserChatProvider implements PreparableChatProvider {
  abstract readonly name: string;
  protected abstract readonly url: string;
  protected abstract readonly selectors: ChatSelectors;

  constructor(
    @Inject(BROWSER_SESSION_FACTORY)
    private readonly sessions: BrowserSessionFactory,
    @Inject(pingAiConfig.KEY)
    private readonly config: ConfigType<typeof pingAiConfig>,
  ) {}

  async prepare(signal?: AbortSignal): Promise<PreparedChat> {
    const session = await this.sessions.createSession({
      timeoutMs: this.config.timeoutMs,
    });
    const chat = new BrowserChat(session, this.selectors);
    const release = closeOnAbort(signal, chat);

    try {
      signal?.throwIfAborted();
      await chat.load(this.url);
      return chat;
    } catch (error) {
      await chat.close();
      throw error;
    } finally {
      release();
    }
  }

  async ask(message: string, options: AskOptions): Promise<string> {
    const chat = await this.prepare(options.signal);
    try {
      options.progress.pageReady(false);
      return await chat.send(message, options);
    } finally {
      await chat.close();
    }
  }
}
