import { Logger } from '@nestjs/common';
import { isRetryable } from '../errors/chat-errors.js';
import {
  AiChatProvider,
  AskOptions,
  AskProgress,
  PreparableChatProvider,
  PreparedChat,
} from '../providers/ai-chat-provider.interface.js';

export interface PrewarmGate {
  allowsTraffic(): boolean;
}

export interface PrewarmOptions {
  refreshMs: number;
  gate?: PrewarmGate;
}

export class PrewarmedChatProvider implements AiChatProvider {
  readonly name: string;
  private readonly logger: Logger;
  private ready: PreparedChat | null = null;
  private preparing: Promise<void> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private stopController: AbortController | null = null;

  constructor(
    private readonly inner: PreparableChatProvider,
    private readonly options: PrewarmOptions,
  ) {
    this.name = inner.name;
    this.logger = new Logger(`Prewarm:${inner.name}`);
  }

  get isWarm(): boolean {
    return this.ready !== null;
  }

  private get running(): boolean {
    return this.stopController !== null;
  }

  start(): Promise<void> {
    if (!this.running) {
      this.stopController = new AbortController();
      this.refreshTimer = setInterval(
        () => this.refresh(),
        this.options.refreshMs,
      );
      this.refreshTimer.unref();
      this.refill();
    }
    return this.preparing ?? Promise.resolve();
  }

  async stop(): Promise<void> {
    this.stopController?.abort();
    this.stopController = null;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    const chat = this.take();
    await chat?.close();
    await this.preparing;
  }

  async ask(message: string, options: AskOptions): Promise<string> {
    const chat = this.take();
    try {
      if (!chat) {
        return await this.inner.ask(message, options);
      }
      return await this.askWarm(chat, message, options);
    } finally {
      this.refill();
    }
  }

  private async askWarm(
    chat: PreparedChat,
    message: string,
    options: AskOptions,
  ): Promise<string> {
    let sent = false;
    const progress: AskProgress = {
      attemptStarted: () => options.progress.attemptStarted(),
      pageReady: (warm) => options.progress.pageReady(warm),
      messageSent: () => {
        sent = true;
        options.progress.messageSent();
      },
      firstToken: () => options.progress.firstToken(),
    };

    let failure: unknown;
    try {
      progress.attemptStarted();
      progress.pageReady(true);
      return await chat.send(message, { signal: options.signal, progress });
    } catch (error) {
      if (sent || options.signal.aborted || !isRetryable(error)) {
        throw error;
      }
      failure = error;
    } finally {
      await chat.close();
    }

    this.logger.warn(
      `Warm page failed before sending (${describe(failure)}). Opening the chat cold`,
    );
    return this.inner.ask(message, options);
  }

  private take(): PreparedChat | null {
    const chat = this.ready;
    this.ready = null;
    return chat;
  }

  private refresh(): void {
    const stale = this.take();
    void stale?.close();
    this.refill();
  }

  private refill(): void {
    if (!this.stopController || this.ready || this.preparing) {
      return;
    }
    if (this.options.gate && !this.options.gate.allowsTraffic()) {
      return;
    }
    const { signal } = this.stopController;
    this.preparing = this.inner
      .prepare({ signal })
      .then(
        async (chat) => {
          if (this.running && !signal.aborted) {
            this.ready = chat;
          } else {
            await chat.close();
          }
        },
        (error: unknown) => {
          if (!signal.aborted) {
            this.logger.warn(
              `Could not prepare a warm page: ${describe(error)}`,
            );
          }
        },
      )
      .finally(() => {
        this.preparing = null;
      });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
