import {
  BrowserSession,
  BrowserSessionFactory,
} from '../../../../../src/modules/browser/browser-session.interface.js';
import { AskProgress } from '../../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';
import {
  BrowserChatProvider,
  ChatSelectors,
} from '../../../../../src/modules/ping-ai/providers/browser-chat.provider.js';
import { ChatGptProvider } from '../../../../../src/modules/ping-ai/providers/chatgpt.provider.js';
import { GeminiProvider } from '../../../../../src/modules/ping-ai/providers/gemini.provider.js';

class TestChatProvider extends BrowserChatProvider {
  readonly name = 'test';
  protected readonly url = 'https://chat.test/';
  protected readonly selectors: ChatSelectors = {
    input: '#input',
    send: '#send',
    response: '.answer',
    busy: '.busy',
  };
}

function fakeSession() {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    waitForVisible: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    waitForText: vi.fn().mockResolvedValue(undefined),
    lastText: vi.fn().mockResolvedValue('Olá!'),
    exists: vi.fn().mockResolvedValue(false),
    pause: vi.fn((ms: number) => {
      vi.setSystemTime(Date.now() + ms);
      return Promise.resolve();
    }),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies BrowserSession;
}

function fakeProgress() {
  return {
    pageReady: vi.fn(),
    messageSent: vi.fn(),
    firstToken: vi.fn(),
  } satisfies AskProgress;
}

describe('BrowserChatProvider', () => {
  let session: ReturnType<typeof fakeSession>;
  let factory: BrowserSessionFactory & {
    createSession: ReturnType<typeof vi.fn>;
  };
  let progress: ReturnType<typeof fakeProgress>;
  let provider: TestChatProvider;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    session = fakeSession();
    factory = { createSession: vi.fn().mockResolvedValue(session) };
    progress = fakeProgress();
    provider = new TestChatProvider(factory, { timeoutMs: 5000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a session with the configured timeout', async () => {
    await provider.ask('Oi!', {
      signal: new AbortController().signal,
      progress,
    });

    expect(factory.createSession).toHaveBeenCalledWith({ timeoutMs: 5000 });
  });

  it('should open the chat, send the message and return the answer', async () => {
    const answer = await provider.ask('Oi!', {
      signal: new AbortController().signal,
      progress,
    });

    expect(answer).toBe('Olá!');
    expect(session.open).toHaveBeenCalledWith('https://chat.test/');
    expect(session.waitForVisible).toHaveBeenCalledWith('#input');
    expect(session.click).toHaveBeenNthCalledWith(1, '#input');
    expect(session.type).toHaveBeenCalledWith('Oi!');
    expect(session.click).toHaveBeenNthCalledWith(2, '#send');
    expect(session.waitForText).toHaveBeenCalledWith('.answer');
  });

  it('should report progress in order', async () => {
    const calls: string[] = [];
    progress.pageReady.mockImplementation(() => calls.push('pageReady'));
    progress.messageSent.mockImplementation(() => calls.push('messageSent'));
    progress.firstToken.mockImplementation(() => calls.push('firstToken'));

    await provider.ask('Oi!', {
      signal: new AbortController().signal,
      progress,
    });

    expect(calls).toEqual(['pageReady', 'messageSent', 'firstToken']);
  });

  it('should wait until the text stops changing and nothing is busy', async () => {
    session.lastText
      .mockResolvedValueOnce('Ol')
      .mockResolvedValueOnce('Olá')
      .mockResolvedValue('Olá, tudo bem?');
    session.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    const answer = await provider.ask('Oi!', {
      signal: new AbortController().signal,
      progress,
    });

    expect(answer).toBe('Olá, tudo bem?');
  });

  it('should trim the answer', async () => {
    session.lastText.mockResolvedValue('  Olá!\n');

    const answer = await provider.ask('Oi!', {
      signal: new AbortController().signal,
      progress,
    });

    expect(answer).toBe('Olá!');
  });

  it('should close the session after answering', async () => {
    await provider.ask('Oi!', {
      signal: new AbortController().signal,
      progress,
    });

    expect(session.close).toHaveBeenCalled();
  });

  it('should close the session when something fails', async () => {
    session.open.mockRejectedValueOnce(new Error('offline'));

    await expect(
      provider.ask('Oi!', { signal: new AbortController().signal, progress }),
    ).rejects.toThrow('offline');
    expect(session.close).toHaveBeenCalled();
  });

  it('should close the session as soon as the signal aborts', async () => {
    const controller = new AbortController();
    session.waitForText.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new Error('Target closed'));
    });

    await expect(
      provider.ask('Oi!', { signal: controller.signal, progress }),
    ).rejects.toThrow('Target closed');
    expect(session.close).toHaveBeenCalledTimes(2);
  });

  it('should not open the chat when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.ask('Oi!', { signal: controller.signal, progress }),
    ).rejects.toThrow();
    expect(session.open).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalled();
  });

  it.each([
    [ChatGptProvider, 'chatgpt', 'https://chatgpt.com/'],
    [GeminiProvider, 'gemini', 'https://gemini.google.com/app'],
  ])('%o should open its own chat url', async (Provider, name, url) => {
    const chat = new Provider(factory, { timeoutMs: 5000 });

    await chat.ask('Oi!', { signal: new AbortController().signal, progress });

    expect(chat.name).toBe(name);
    expect(session.open).toHaveBeenCalledWith(url);
  });
});
