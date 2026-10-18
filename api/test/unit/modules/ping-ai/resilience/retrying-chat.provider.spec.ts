import { Logger } from '@nestjs/common';
import { ChatBlockedError } from '../../../../../src/modules/ping-ai/errors/chat-errors.js';
import {
  AskOptions,
  PreparableChatProvider,
  PreparedChat,
  PrepareOptions,
} from '../../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';
import { RetryingChatProvider } from '../../../../../src/modules/ping-ai/resilience/retrying-chat.provider.js';

function fakeChat() {
  return {
    send: vi.fn().mockResolvedValue('Olá!'),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies PreparedChat;
}

function askOptions(signal = new AbortController().signal): AskOptions {
  return {
    signal,
    progress: {
      attemptStarted: vi.fn(),
      pageReady: vi.fn(),
      messageSent: vi.fn(),
      firstToken: vi.fn(),
    },
  };
}

describe('RetryingChatProvider', () => {
  let chat: ReturnType<typeof fakeChat>;
  let inner: PreparableChatProvider & {
    prepare: ReturnType<
      typeof vi.fn<(options?: PrepareOptions) => Promise<PreparedChat>>
    >;
  };
  let provider: RetryingChatProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    chat = fakeChat();
    inner = {
      name: 'gemini',
      prepare: vi.fn((options?: PrepareOptions) => {
        options?.onAttempt?.();
        return Promise.resolve<PreparedChat>(chat);
      }),
      ask: vi.fn(),
    };
    provider = new RetryingChatProvider(inner, {
      attempts: 3,
      backoffMs: 1000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should keep the name of the wrapped provider', () => {
    expect(provider.name).toBe('gemini');
  });

  it('should answer on the first attempt when the chat opens', async () => {
    const options = askOptions();

    await expect(provider.ask('Oi!', options)).resolves.toBe('Olá!');

    expect(inner.prepare).toHaveBeenCalledTimes(1);
    expect(options.progress.attemptStarted).toHaveBeenCalledTimes(1);
    expect(options.progress.pageReady).toHaveBeenCalledWith(false);
    expect(chat.close).toHaveBeenCalled();
  });

  it('should open the chat again when it fails to open, and count each attempt', async () => {
    inner.prepare.mockImplementationOnce((options?: PrepareOptions) => {
      options?.onAttempt?.();
      return Promise.reject(new Error('input not found'));
    });
    const options = askOptions();

    const answer = provider.ask('Oi!', options);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(answer).resolves.toBe('Olá!');
    expect(inner.prepare).toHaveBeenCalledTimes(2);
    expect(options.progress.attemptStarted).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempt 1/3 failed to open the chat (input not found)',
      ),
    );
  });

  it('should not retry when the site blocked the access', async () => {
    inner.prepare.mockRejectedValue(new ChatBlockedError('gemini', 'captcha'));

    await expect(provider.ask('Oi!', askOptions())).rejects.toBeInstanceOf(
      ChatBlockedError,
    );
    expect(inner.prepare).toHaveBeenCalledTimes(1);
  });

  it('should give up after the configured attempts', async () => {
    inner.prepare.mockRejectedValue(new Error('Cloudflare'));

    const answer = provider.ask('Oi!', askOptions());
    const assertion = expect(answer).rejects.toThrow('Cloudflare');
    await vi.advanceTimersByTimeAsync(1000 + 2000);

    await assertion;
    expect(inner.prepare).toHaveBeenCalledTimes(3);
  });

  it('should never send the message again when the failure happens after opening', async () => {
    chat.send.mockRejectedValueOnce(new Error('Target closed'));

    await expect(provider.ask('Oi!', askOptions())).rejects.toThrow(
      'Target closed',
    );

    expect(inner.prepare).toHaveBeenCalledTimes(1);
    expect(chat.send).toHaveBeenCalledTimes(1);
    expect(chat.close).toHaveBeenCalled();
  });

  it('should stop retrying when the request is aborted', async () => {
    const controller = new AbortController();
    inner.prepare.mockRejectedValue(new Error('slow page'));

    const answer = provider.ask('Oi!', askOptions(controller.signal));
    const assertion = expect(answer).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    controller.abort(new Error('timeout'));

    await assertion;
    expect(inner.prepare).toHaveBeenCalledTimes(1);
  });

  it('should also retry background preparations', async () => {
    inner.prepare.mockRejectedValueOnce(new Error('input not found'));

    const prepared = provider.prepare();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(prepared).resolves.toBe(chat);
    expect(inner.prepare).toHaveBeenCalledTimes(2);
  });
});
