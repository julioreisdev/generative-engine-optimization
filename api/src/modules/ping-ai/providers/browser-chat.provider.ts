import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { pingAiConfig } from '../../../config/ping-ai.config.js';
import {
  BROWSER_SESSION_FACTORY,
  type BrowserSession,
  type BrowserSessionFactory,
} from '../../browser/browser-session.interface.js';
import { AiChatProvider, AskOptions } from './ai-chat-provider.interface.js';

export interface ChatSelectors {
  input: string;
  send: string;
  response: string;
  busy: string;
}

const POLL_INTERVAL_MS = 250;
const STABLE_TEXT_MS = 1000;

@Injectable()
export abstract class BrowserChatProvider implements AiChatProvider {
  abstract readonly name: string;
  protected abstract readonly url: string;
  protected abstract readonly selectors: ChatSelectors;

  constructor(
    @Inject(BROWSER_SESSION_FACTORY)
    private readonly sessions: BrowserSessionFactory,
    @Inject(pingAiConfig.KEY)
    private readonly config: ConfigType<typeof pingAiConfig>,
  ) {}

  async ask(
    message: string,
    { signal, progress }: AskOptions,
  ): Promise<string> {
    const session = await this.sessions.createSession({
      timeoutMs: this.config.timeoutMs,
    });
    const close = () => void session.close();
    signal.addEventListener('abort', close, { once: true });

    try {
      signal.throwIfAborted();

      await session.open(this.url);
      await session.waitForVisible(this.selectors.input);
      progress.pageReady();

      await session.click(this.selectors.input);
      await session.type(message);
      await session.click(this.selectors.send);
      progress.messageSent();

      await session.waitForText(this.selectors.response);
      progress.firstToken();

      return await this.waitForStableResponse(session);
    } finally {
      signal.removeEventListener('abort', close);
      await session.close();
    }
  }

  private async waitForStableResponse(
    session: BrowserSession,
  ): Promise<string> {
    let previous = '';
    let stableSince = Date.now();

    for (;;) {
      const text = (await session.lastText(this.selectors.response)).trim();
      const busy = await session.exists(this.selectors.busy);

      if (text !== previous) {
        previous = text;
        stableSince = Date.now();
      } else if (text && !busy && Date.now() - stableSince >= STABLE_TEXT_MS) {
        return text;
      }

      await session.pause(POLL_INTERVAL_MS);
    }
  }
}
