import { Logger } from '@nestjs/common';
import { retry } from '../../../common/retry.js';
import { isRetryable } from '../errors/chat-errors.js';
import {
  AskOptions,
  PreparableChatProvider,
  PreparedChat,
  PrepareOptions,
} from '../providers/ai-chat-provider.interface.js';
import { askThroughPrepare } from '../providers/ask-through-prepare.js';

export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
}

export class RetryingChatProvider implements PreparableChatProvider {
  readonly name: string;
  private readonly logger: Logger;

  constructor(
    private readonly inner: PreparableChatProvider,
    private readonly policy: RetryPolicy,
  ) {
    this.name = inner.name;
    this.logger = new Logger(`Retry:${inner.name}`);
  }

  prepare(options: PrepareOptions = {}): Promise<PreparedChat> {
    return retry(() => this.inner.prepare(options), {
      attempts: this.policy.attempts,
      backoffMs: this.policy.backoffMs,
      signal: options.signal,
      shouldRetry: isRetryable,
      onRetry: (failedAttempt, error, delayMs) => {
        this.logger.warn(
          `Attempt ${failedAttempt}/${this.policy.attempts} failed to open the chat (${describe(error)}). Retrying in ${delayMs}ms`,
        );
      },
    });
  }

  ask(message: string, options: AskOptions): Promise<string> {
    return askThroughPrepare(this, message, options);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
