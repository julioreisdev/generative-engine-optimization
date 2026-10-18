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
  PrepareOptions,
} from './ai-chat-provider.interface.js';
import { askThroughPrepare } from './ask-through-prepare.js';
import { BlockDetector } from './block-detector.js';
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
  protected abstract readonly blockers: BlockDetector[];

  constructor(
    @Inject(BROWSER_SESSION_FACTORY)
    private readonly sessions: BrowserSessionFactory,
    @Inject(pingAiConfig.KEY)
    private readonly config: ConfigType<typeof pingAiConfig>,
  ) {}

  async prepare({
    signal,
    onAttempt,
  }: PrepareOptions = {}): Promise<PreparedChat> {
    onAttempt?.();
    const session = await this.sessions.createSession({
      timeoutMs: this.config.timeoutMs,
    });
    const chat = new BrowserChat(session, {
      name: this.name,
      selectors: this.selectors,
      blockers: this.blockers,
      readyTimeoutMs: this.config.pageReadyTimeoutMs,
    });
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

  ask(message: string, options: AskOptions): Promise<string> {
    return askThroughPrepare(this, message, options);
  }
}
