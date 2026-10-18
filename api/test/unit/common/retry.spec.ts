import { retry } from '../../../src/common/retry.js';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the first successful result without waiting', async () => {
    const action = vi.fn().mockResolvedValue('ok');

    await expect(retry(action, { attempts: 3, backoffMs: 1000 })).resolves.toBe(
      'ok',
    );
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('should try again with exponential backoff until it works', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();

    const result = retry(action, { attempts: 3, backoffMs: 1000, onRetry });
    await vi.advanceTimersByTimeAsync(1000);
    expect(action).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toBe('ok');
    expect(action).toHaveBeenNthCalledWith(3, 3);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, new Error('first'), 1000);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, new Error('second'), 2000);
  });

  it('should throw the last error when all attempts fail', async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('last'));

    const result = retry(action, { attempts: 2, backoffMs: 10 });
    const assertion = expect(result).rejects.toThrow('last');
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('should not retry errors that shouldRetry rejects', async () => {
    const action = vi.fn().mockRejectedValue(new Error('blocked'));
    const onRetry = vi.fn();

    await expect(
      retry(action, {
        attempts: 3,
        backoffMs: 10,
        shouldRetry: (error) => (error as Error).message !== 'blocked',
        onRetry,
      }),
    ).rejects.toThrow('blocked');
    expect(action).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('should not retry when attempts is 1', async () => {
    const action = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(retry(action, { attempts: 1, backoffMs: 10 })).rejects.toThrow(
      'boom',
    );
    expect(action).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, Number.NaN, 1.5, undefined as unknown as number])(
    'should try only once when attempts is invalid (%s)',
    async (attempts) => {
      const action = vi.fn().mockRejectedValue(new Error('boom'));

      await expect(retry(action, { attempts, backoffMs: 10 })).rejects.toThrow(
        'boom',
      );
      expect(action).toHaveBeenCalledTimes(1);
    },
  );

  it('should stop waiting and give up when the signal aborts', async () => {
    const controller = new AbortController();
    const action = vi.fn().mockRejectedValue(new Error('boom'));

    const result = retry(action, {
      attempts: 3,
      backoffMs: 10000,
      signal: controller.signal,
    });
    const assertion = expect(result).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(0);
    controller.abort(new Error('timeout'));

    await assertion;
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('should not retry when the action failed because of the abort', async () => {
    const controller = new AbortController();
    const action = vi.fn(() => {
      controller.abort(new Error('timeout'));
      return Promise.reject(new Error('Target closed'));
    });

    await expect(
      retry(action, { attempts: 3, backoffMs: 10, signal: controller.signal }),
    ).rejects.toThrow('Target closed');
    expect(action).toHaveBeenCalledTimes(1);
  });
});
