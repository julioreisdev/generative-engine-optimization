import { Logger } from '@nestjs/common';
import { ChatBlockedError } from '../../../../../src/modules/ping-ai/errors/chat-errors.js';
import { PrewarmedChatProvider } from '../../../../../src/modules/ping-ai/prewarm/prewarmed-chat.provider.js';
import {
  AskOptions,
  PreparableChatProvider,
  PreparedChat,
  PrepareOptions,
} from '../../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';

const REFRESH_MS = 600000;

function fakeChat(answer = 'Olá!') {
  return {
    send: vi.fn().mockResolvedValue(answer),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies PreparedChat;
}

function fakeInner() {
  const chats: ReturnType<typeof fakeChat>[] = [];
  const inner = {
    name: 'chatgpt',
    prepare: vi.fn((_options?: PrepareOptions): Promise<PreparedChat> => {
      const chat = fakeChat();
      chats.push(chat);
      return Promise.resolve(chat);
    }),
    ask: vi.fn().mockResolvedValue('resposta a frio'),
  } satisfies PreparableChatProvider;
  return { inner, chats };
}

function askOptions(): AskOptions {
  return {
    signal: new AbortController().signal,
    progress: {
      attemptStarted: vi.fn(),
      pageReady: vi.fn(),
      messageSent: vi.fn(),
      firstToken: vi.fn(),
    },
  };
}

describe('PrewarmedChatProvider', () => {
  let inner: ReturnType<typeof fakeInner>['inner'];
  let chats: ReturnType<typeof fakeInner>['chats'];
  let provider: PrewarmedChatProvider;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    ({ inner, chats } = fakeInner());
    provider = new PrewarmedChatProvider(inner, { refreshMs: REFRESH_MS });
  });

  afterEach(async () => {
    await provider.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should keep the name of the wrapped provider', () => {
    expect(provider.name).toBe('chatgpt');
  });

  it('should prepare a page when started', async () => {
    await provider.start();

    expect(inner.prepare).toHaveBeenCalledTimes(1);
    expect(provider.isWarm).toBe(true);
  });

  it('should answer with the warm page without opening a new one', async () => {
    await provider.start();
    const options = askOptions();

    const answer = await provider.ask('Oi!', options);

    expect(answer).toBe('Olá!');
    expect(options.progress.attemptStarted).toHaveBeenCalledTimes(1);
    expect(options.progress.pageReady).toHaveBeenCalledWith(true);
    expect(chats[0].send).toHaveBeenCalledWith(
      'Oi!',
      expect.objectContaining({ signal: options.signal }),
    );
    expect(chats[0].close).toHaveBeenCalled();
    expect(inner.ask).not.toHaveBeenCalled();
  });

  it('should forward the progress of the warm page to the caller', async () => {
    await provider.start();
    chats[0].send.mockImplementationOnce(
      (_message: string, { progress }: AskOptions) => {
        progress.messageSent();
        progress.firstToken();
        return Promise.resolve('Olá!');
      },
    );
    const options = askOptions();

    await provider.ask('Oi!', options);

    expect(options.progress.messageSent).toHaveBeenCalledTimes(1);
    expect(options.progress.firstToken).toHaveBeenCalledTimes(1);
  });

  it('should prepare a new page after using the warm one', async () => {
    await provider.start();

    await provider.ask('Oi!', askOptions());

    await vi.waitFor(() => expect(provider.isWarm).toBe(true));
    expect(inner.prepare).toHaveBeenCalledTimes(2);
  });

  it('should open the chat cold when there is no warm page', async () => {
    const answer = await provider.ask('Oi!', askOptions());

    expect(answer).toBe('resposta a frio');
    expect(inner.ask).toHaveBeenCalledTimes(1);
  });

  it('should open the second of two simultaneous requests cold', async () => {
    await provider.start();

    const answers = await Promise.all([
      provider.ask('Oi!', askOptions()),
      provider.ask('Oi!', askOptions()),
    ]);

    expect(answers).toEqual(['Olá!', 'resposta a frio']);
  });

  it('should fall back to cold and try again later when preparing fails', async () => {
    inner.prepare.mockRejectedValueOnce(new Error('Cloudflare'));

    await provider.start();

    expect(provider.isWarm).toBe(false);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cloudflare'),
    );
    await expect(provider.ask('Oi!', askOptions())).resolves.toBe(
      'resposta a frio',
    );
    await vi.waitFor(() => expect(provider.isWarm).toBe(true));
  });

  it('should open the chat cold when the warm page fails before sending', async () => {
    await provider.start();
    chats[0].send.mockRejectedValueOnce(new Error('input not found'));
    const options = askOptions();

    const answer = await provider.ask('Oi!', options);

    expect(answer).toBe('resposta a frio');
    expect(chats[0].close).toHaveBeenCalled();
    expect(inner.ask).toHaveBeenCalledWith('Oi!', options);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('input not found'),
    );
  });

  it('should close the stale warm page before opening the cold one', async () => {
    await provider.start();
    chats[0].send.mockRejectedValueOnce(new Error('input not found'));
    inner.ask.mockImplementationOnce(() => {
      expect(chats[0].close).toHaveBeenCalled();
      return Promise.resolve('resposta a frio');
    });

    await expect(provider.ask('Oi!', askOptions())).resolves.toBe(
      'resposta a frio',
    );
  });

  it('should not resend when the warm page fails after sending', async () => {
    await provider.start();
    chats[0].send.mockImplementationOnce(
      (_message: string, { progress }: AskOptions) => {
        progress.messageSent();
        return Promise.reject(new Error('Target closed'));
      },
    );

    await expect(provider.ask('Oi!', askOptions())).rejects.toThrow(
      'Target closed',
    );

    expect(inner.ask).not.toHaveBeenCalled();
    expect(chats[0].close).toHaveBeenCalled();
    await vi.waitFor(() => expect(provider.isWarm).toBe(true));
  });

  it('should not prepare pages while the gate is closed', async () => {
    const gate = { allowsTraffic: vi.fn().mockReturnValue(false) };
    const gated = new PrewarmedChatProvider(inner, {
      refreshMs: REFRESH_MS,
      gate,
    });

    await gated.start();

    expect(inner.prepare).not.toHaveBeenCalled();
    expect(gated.isWarm).toBe(false);

    gate.allowsTraffic.mockReturnValue(true);
    await gated.ask('Oi!', askOptions());
    await vi.waitFor(() => expect(gated.isWarm).toBe(true));
    await gated.stop();
  });

  it('should not open the chat cold when the warm page shows a block', async () => {
    await provider.start();
    chats[0].send.mockRejectedValueOnce(
      new ChatBlockedError('chatgpt', 'rate-limit'),
    );

    await expect(provider.ask('Oi!', askOptions())).rejects.toBeInstanceOf(
      ChatBlockedError,
    );
    expect(inner.ask).not.toHaveBeenCalled();
  });

  it('should not open the chat cold when the request was aborted', async () => {
    await provider.start();
    const controller = new AbortController();
    chats[0].send.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new Error('Target closed'));
    });

    await expect(
      provider.ask('Oi!', { ...askOptions(), signal: controller.signal }),
    ).rejects.toThrow('Target closed');

    expect(inner.ask).not.toHaveBeenCalled();
  });

  it('should cancel a background preparation when stopped', async () => {
    let signal: AbortSignal | undefined;
    inner.prepare.mockImplementationOnce((options?: PrepareOptions) => {
      signal = options?.signal;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    });
    const started = provider.start();

    await provider.stop();
    await started;

    expect(signal?.aborted).toBe(true);
    expect(Logger.prototype.warn).not.toHaveBeenCalled();
  });

  it('should replace the warm page on every refresh interval', async () => {
    vi.useFakeTimers();
    await provider.start();

    await vi.advanceTimersByTimeAsync(REFRESH_MS);

    expect(chats[0].close).toHaveBeenCalled();
    expect(inner.prepare).toHaveBeenCalledTimes(2);
    expect(provider.isWarm).toBe(true);
  });

  it('should close the warm page and stop refreshing when stopped', async () => {
    vi.useFakeTimers();
    await provider.start();

    await provider.stop();
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);

    expect(chats[0].close).toHaveBeenCalled();
    expect(inner.prepare).toHaveBeenCalledTimes(1);
    expect(provider.isWarm).toBe(false);
  });

  it('should close a page that finishes loading after stop', async () => {
    const started = provider.start();

    await provider.stop();
    await started;

    expect(chats[0].close).toHaveBeenCalled();
    expect(provider.isWarm).toBe(false);
  });
});
