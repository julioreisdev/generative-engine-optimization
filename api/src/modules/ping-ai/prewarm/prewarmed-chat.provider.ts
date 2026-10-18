import { Logger } from '@nestjs/common';
import {
  AiChatProvider,
  AskOptions,
  PreparableChatProvider,
  PreparedChat,
} from '../providers/ai-chat-provider.interface.js';

export interface PrewarmOptions {
  refreshMs: number;
}

export class PrewarmedChatProvider implements AiChatProvider {
  readonly name: string;
  private readonly logger: Logger;
  private ready: PreparedChat | null = null;
  private preparing: Promise<void> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private running = false;

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

  start(): Promise<void> {
    if (!this.running) {
      this.running = true;
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
    this.running = false;
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
      try {
        options.progress.pageReady(true);
        return await chat.send(message, options);
      } finally {
        await chat.close();
      }
    } finally {
      this.refill();
    }
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
    if (!this.running || this.ready || this.preparing) {
      return;
    }
    this.preparing = this.inner
      .prepare()
      .then(
        async (chat) => {
          if (this.running) {
            this.ready = chat;
          } else {
            await chat.close();
          }
        },
        (error: unknown) => {
          this.logger.warn(
            `Could not prepare a warm page: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      )
      .finally(() => {
        this.preparing = null;
      });
  }
}
