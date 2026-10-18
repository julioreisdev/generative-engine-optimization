import { pingAiConfig } from '../../../../src/config/ping-ai.config.js';
import { buildChatChain } from '../../../../src/modules/ping-ai/chat-chain.js';
import { ChatUnavailableError } from '../../../../src/modules/ping-ai/errors/chat-errors.js';
import { PrewarmedChatProvider } from '../../../../src/modules/ping-ai/prewarm/prewarmed-chat.provider.js';
import {
  AskOptions,
  PreparableChatProvider,
} from '../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';
import { CircuitBreakerChatProvider } from '../../../../src/modules/ping-ai/resilience/circuit-breaker-chat.provider.js';

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

describe('buildChatChain', () => {
  const site: PreparableChatProvider = {
    name: 'chatgpt',
    prepare: vi.fn().mockRejectedValue(new Error('Cloudflare')),
    ask: vi.fn(),
  };
  const config = {
    ...pingAiConfig(),
    retryAttempts: 1,
    breakerFailures: 2,
  };

  it('should put the circuit breaker outside and expose the prewarmed layer', () => {
    const chain = buildChatChain(site, { ...config, prewarm: true });

    expect(chain.provider).toBeInstanceOf(CircuitBreakerChatProvider);
    expect(chain.provider.name).toBe('chatgpt');
    expect(chain.prewarmed).toBeInstanceOf(PrewarmedChatProvider);
  });

  it('should not create a prewarmed layer when prewarm is off', () => {
    const chain = buildChatChain(site, { ...config, prewarm: false });

    expect(chain.provider).toBeInstanceOf(CircuitBreakerChatProvider);
    expect(chain.prewarmed).toBeNull();
  });

  it('should pause the site after consecutive failures through the whole chain', async () => {
    const chain = buildChatChain(site, { ...config, prewarm: false });

    await expect(chain.provider.ask('Oi!', askOptions())).rejects.toThrow(
      'Cloudflare',
    );
    await expect(chain.provider.ask('Oi!', askOptions())).rejects.toThrow(
      'Cloudflare',
    );
    await expect(
      chain.provider.ask('Oi!', askOptions()),
    ).rejects.toBeInstanceOf(ChatUnavailableError);
    expect(site.prepare).toHaveBeenCalledTimes(2);
  });

  it('should stop preparing warm pages while the site is paused', async () => {
    vi.useFakeTimers();
    const prepare = vi.fn().mockRejectedValue(new Error('Cloudflare'));
    const chain = buildChatChain(
      { ...site, prepare },
      { ...config, prewarm: true, prewarmRefreshMs: 1000 },
    );
    await chain.prewarmed?.start();
    await chain.provider.ask('Oi!', askOptions()).catch(() => undefined);
    await chain.provider.ask('Oi!', askOptions()).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    prepare.mockClear();

    await vi.advanceTimersByTimeAsync(5000);

    expect(prepare).not.toHaveBeenCalled();
    await chain.prewarmed?.stop();
    vi.useRealTimers();
  });
});
