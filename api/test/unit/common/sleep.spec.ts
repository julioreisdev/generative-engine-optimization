import { sleep } from '../../../src/common/sleep.js';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after the given time', async () => {
    const done = vi.fn();
    void sleep(1000).then(done);

    await vi.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });

  it('should reject as soon as the signal aborts', async () => {
    const controller = new AbortController();
    const waiting = sleep(10000, controller.signal);

    controller.abort(new Error('cancelled'));

    await expect(waiting).rejects.toThrow('cancelled');
  });

  it('should reject right away when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));

    await expect(sleep(10000, controller.signal)).rejects.toThrow('cancelled');
  });
});
