import { Logger } from '@nestjs/common';
import { CircuitBreaker } from '../../../common/circuit-breaker.js';
import { ChatUnavailableError } from '../errors/chat-errors.js';
import {
  AiChatProvider,
  AskOptions,
} from '../providers/ai-chat-provider.interface.js';

export class CircuitBreakerChatProvider implements AiChatProvider {
  readonly name: string;
  private readonly logger: Logger;

  constructor(
    private readonly inner: AiChatProvider,
    private readonly breaker: CircuitBreaker,
  ) {
    this.name = inner.name;
    this.logger = new Logger(`CircuitBreaker:${inner.name}`);
  }

  async ask(message: string, options: AskOptions): Promise<string> {
    if (!this.breaker.tryAcquire()) {
      throw new ChatUnavailableError(
        this.name,
        this.breaker.remainingCooldownMs(),
      );
    }
    try {
      const answer = await this.inner.ask(message, options);
      if (this.breaker.failures > 0) {
        this.logger.log(`${this.name} answered again. Circuit closed`);
      }
      this.breaker.recordSuccess();
      return answer;
    } catch (error) {
      if (this.breaker.recordFailure()) {
        this.logger.warn(
          `${this.name} paused for ${Math.ceil(this.breaker.remainingCooldownMs() / 1000)}s after ${this.breaker.failures} consecutive failures`,
        );
      }
      throw error;
    }
  }
}
