import { closeOnAbort } from '../../../common/close-on-abort.js';
import { OperationTimeoutError } from '../../../common/with-timeout.js';
import { type BrowserSession } from '../../browser/browser-session.interface.js';
import { ChatBlockedError, ChatNotReadyError } from '../errors/chat-errors.js';
import { AskOptions, PreparedChat } from './ai-chat-provider.interface.js';
import { BlockDetector, findBlock } from './block-detector.js';
import type { ChatSelectors } from './browser-chat.provider.js';

const POLL_INTERVAL_MS = 250;
const STABLE_TEXT_MS = 1000;

export interface ChatProfile {
  name: string;
  selectors: ChatSelectors;
  blockers: BlockDetector[];
  readyTimeoutMs: number;
}

export class BrowserChat implements PreparedChat {
  private readonly selectors: ChatSelectors;

  constructor(
    private readonly session: BrowserSession,
    private readonly profile: ChatProfile,
  ) {
    this.selectors = profile.selectors;
  }

  async load(url: string): Promise<void> {
    await this.session.open(url);
    try {
      await this.session.waitForVisible(
        this.selectors.input,
        this.profile.readyTimeoutMs,
      );
    } catch (error) {
      await this.throwIfBlocked();
      if (error instanceof OperationTimeoutError) {
        throw new ChatNotReadyError(
          this.profile.name,
          this.profile.readyTimeoutMs,
        );
      }
      throw error;
    }
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

      try {
        await this.session.waitForText(this.selectors.response);
      } catch (error) {
        await this.throwIfBlocked();
        throw error;
      }
      progress.firstToken();

      return await this.waitForStableResponse();
    } finally {
      release();
    }
  }

  close(): Promise<void> {
    return this.session.close();
  }

  private async throwIfBlocked(): Promise<void> {
    const snapshot = await this.session.inspect().catch(() => null);
    const reason = snapshot && findBlock(snapshot, this.profile.blockers);
    if (reason) {
      throw new ChatBlockedError(this.profile.name, reason);
    }
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
