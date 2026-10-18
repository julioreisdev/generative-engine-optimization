export type BlockReason = 'captcha' | 'login' | 'rate-limit';

export class ChatBlockedError extends Error {
  constructor(
    readonly provider: string,
    readonly reason: BlockReason,
  ) {
    super(`${provider} blocked the access (${reason})`);
    this.name = 'ChatBlockedError';
  }
}

export class ChatNotReadyError extends Error {
  constructor(provider: string, timeoutMs: number) {
    super(
      `${provider}: the message input did not appear within ${timeoutMs}ms. The page may be slow or its selectors may have changed`,
    );
    this.name = 'ChatNotReadyError';
  }
}

export class ChatUnavailableError extends Error {
  constructor(
    readonly provider: string,
    readonly retryInMs: number,
  ) {
    super(
      `${provider} is paused after consecutive failures. Next try in ${Math.ceil(retryInMs / 1000)}s`,
    );
    this.name = 'ChatUnavailableError';
  }
}

export function isRetryable(error: unknown): boolean {
  return !(
    error instanceof ChatBlockedError || error instanceof ChatUnavailableError
  );
}
