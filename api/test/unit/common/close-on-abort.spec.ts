import { closeOnAbort } from '../../../src/common/close-on-abort.js';

describe('closeOnAbort', () => {
  const target = { close: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should close the target when the signal aborts', () => {
    const controller = new AbortController();
    closeOnAbort(controller.signal, target);

    controller.abort();

    expect(target.close).toHaveBeenCalledTimes(1);
  });

  it('should stop listening after release', () => {
    const controller = new AbortController();
    const release = closeOnAbort(controller.signal, target);

    release();
    controller.abort();

    expect(target.close).not.toHaveBeenCalled();
  });

  it('should do nothing without a signal', () => {
    const release = closeOnAbort(undefined, target);

    release();

    expect(target.close).not.toHaveBeenCalled();
  });
});
