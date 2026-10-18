import { sleep } from './sleep.js';

export interface RetryOptions {
  attempts: number;
  backoffMs: number;
  signal?: AbortSignal;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (failedAttempt: number, error: unknown, delayMs: number) => void;
}

export async function retry<T>(
  action: (attempt: number) => Promise<T>,
  {
    attempts,
    backoffMs,
    signal,
    shouldRetry = () => true,
    onRetry,
  }: RetryOptions,
): Promise<T> {
  const maxAttempts = Number.isInteger(attempts) && attempts > 0 ? attempts : 1;
  for (let attempt = 1; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await action(attempt);
    } catch (error) {
      if (attempt >= maxAttempts || signal?.aborted || !shouldRetry(error)) {
        throw error;
      }
      const delayMs = backoffMs * 2 ** (attempt - 1);
      onRetry?.(attempt, error, delayMs);
      await sleep(delayMs, signal);
    }
  }
}
