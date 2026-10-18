import { closeOnAbort } from '../../../common/close-on-abort.js';
import { type BrowserSession } from '../../browser/browser-session.interface.js';
import { AskOptions, PreparedChat } from './ai-chat-provider.interface.js';
import type { ChatSelectors } from './browser-chat.provider.js';

const POLL_INTERVAL_MS = 250;
const STABLE_TEXT_MS = 1000;

export class BrowserChat implements PreparedChat {
  constructor(
    private readonly session: BrowserSession,
    private readonly selectors: ChatSelectors,
  ) {}

  async load(url: string): Promise<void> {
    await this.session.open(url);
    await this.session.waitForVisible(this.selectors.input);
  }

  async send(
    message: string,
    { signal, progress }: AskOptions,
  ): Promise<string> {
    const release = closeOnAbort(signal, this);
    try {
      signal.throwIfAborted();

      await this.session.click(this.selectors.input);
      await this.session.type(message);
      await this.session.click(this.selectors.send);
      progress.messageSent();

      await this.session.waitForText(this.selectors.response);
      progress.firstToken();

      return await this.waitForStableResponse();
    } finally {
      release();
    }
  }

  close(): Promise<void> {
    return this.session.close();
  }

  private async waitForStableResponse(): Promise<string> {
    let previous = '';
    let stableSince = Date.now();

    for (;;) {
      const text = (
        await this.session.lastText(this.selectors.response)
      ).trim();
      const busy = await this.session.exists(this.selectors.busy);

      if (text !== previous) {
        previous = text;
        stableSince = Date.now();
      } else if (text && !busy && Date.now() - stableSince >= STABLE_TEXT_MS) {
        return text;
      }

      await this.session.pause(POLL_INTERVAL_MS);
    }
  }
}
