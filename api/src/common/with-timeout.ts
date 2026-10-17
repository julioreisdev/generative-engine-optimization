export class OperationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timeout after ${timeoutMs}ms`);
    this.name = 'OperationTimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new OperationTimeoutError(timeoutMs)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
