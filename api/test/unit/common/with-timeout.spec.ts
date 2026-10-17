import {
  OperationTimeoutError,
  withTimeout,
} from '../../../src/common/with-timeout.js';

describe('withTimeout', () => {
  it('should resolve with the promise value when it finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('should reject with OperationTimeoutError when the promise is too slow', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));

    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(
      OperationTimeoutError,
    );
  });

  it('should keep the original error when the promise rejects in time', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 50),
    ).rejects.toThrow('boom');
  });
});
