import { Logger } from '@nestjs/common';
import { CircuitBreaker } from '../../../../../src/common/circuit-breaker.js';
import { ChatUnavailableError } from '../../../../../src/modules/ping-ai/errors/chat-errors.js';
import {
  AiChatProvider,
  AskOptions,
} from '../../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';
import { CircuitBreakerChatProvider } from '../../../../../src/modules/ping-ai/resilience/circuit-breaker-chat.provider.js';

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

describe('CircuitBreakerChatProvider', () => {
  let now: number;
  let inner: AiChatProvider & { ask: ReturnType<typeof vi.fn> };
  let provider: CircuitBreakerChatProvider;

  beforeEach(() => {
    now = 0;
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    inner = { name: 'chatgpt', ask: vi.fn().mockResolvedValue('Olá!') };
    provider = new CircuitBreakerChatProvider(
      inner,
      new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 300000,
        clock: () => now,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function failTimes(times: number): Promise<void> {
    inner.ask.mockRejectedValue(new Error('Cloudflare'));
    for (let i = 0; i < times; i++) {
      await provider.ask('Oi!', askOptions()).catch(() => undefined);
    }
  }

  it('should keep the name of the wrapped provider', () => {
    expect(provider.name).toBe('chatgpt');
  });

  it('should pass requests through while the site works', async () => {
    await expect(provider.ask('Oi!', askOptions())).resolves.toBe('Olá!');
    expect(inner.ask).toHaveBeenCalledTimes(1);
  });

  it('should keep the original error of a failed request', async () => {
    inner.ask.mockRejectedValue(new Error('Cloudflare'));

    await expect(provider.ask('Oi!', askOptions())).rejects.toThrow(
      'Cloudflare',
    );
  });

  it('should answer unavailable right away after consecutive failures', async () => {
    await failTimes(2);
    now = 20000;

    const result = provider.ask('Oi!', askOptions());

    await expect(result).rejects.toBeInstanceOf(ChatUnavailableError);
    await expect(result).rejects.toThrow(
      'chatgpt is paused after consecutive failures. Next try in 280s',
    );
    expect(inner.ask).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'chatgpt paused for 300s after 2 consecutive failures',
    );
  });

  it('should try the site again after the pause and close when it works', async () => {
    await failTimes(2);
    now = 300000;
    inner.ask.mockResolvedValue('Voltei!');

    await expect(provider.ask('Oi!', askOptions())).resolves.toBe('Voltei!');
    await expect(provider.ask('Oi!', askOptions())).resolves.toBe('Voltei!');
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'chatgpt answered again. Circuit closed',
    );
  });

  it('should pause again when the trial after the pause fails', async () => {
    await failTimes(2);
    now = 300000;

    await expect(provider.ask('Oi!', askOptions())).rejects.toThrow(
      'Cloudflare',
    );
    await expect(provider.ask('Oi!', askOptions())).rejects.toBeInstanceOf(
      ChatUnavailableError,
    );
  });
});
