import { Test } from '@nestjs/testing';
import { pingAiConfig } from '../../../../src/config/ping-ai.config.js';
import { ChatBlockedError } from '../../../../src/modules/ping-ai/errors/chat-errors.js';
import {
  PING_AI_MESSAGE,
  PingAiService,
} from '../../../../src/modules/ping-ai/ping-ai.service.js';
import {
  AI_CHAT_PROVIDERS,
  AiChatProvider,
  AskOptions,
} from '../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';

type Ask = (message: string, options: AskOptions) => Promise<string>;

function fakeProvider(name: string, ask: Ask) {
  return { name, ask: vi.fn(ask) } satisfies AiChatProvider;
}

function answering(text: string): Ask {
  return (_message, { progress }) => {
    progress.pageReady(false);
    progress.messageSent();
    progress.firstToken();
    return Promise.resolve(text);
  };
}

describe('PingAiService', () => {
  async function createService(providers: AiChatProvider[]) {
    const module = await Test.createTestingModule({
      providers: [
        PingAiService,
        { provide: AI_CHAT_PROVIDERS, useValue: providers },
        { provide: pingAiConfig.KEY, useValue: { timeoutMs: 100 } },
      ],
    }).compile();
    return module.get(PingAiService);
  }

  it('should send the message to every provider and return their answers', async () => {
    const chatgpt = fakeProvider('chatgpt', answering('Olá!'));
    const gemini = fakeProvider('gemini', answering('Oi, tudo bem?'));
    const service = await createService([chatgpt, gemini]);

    const result = await service.run();

    expect(result.message).toBe(PING_AI_MESSAGE);
    expect(result.results).toEqual([
      expect.objectContaining({
        provider: 'chatgpt',
        status: 'success',
        response: 'Olá!',
      }),
      expect.objectContaining({
        provider: 'gemini',
        status: 'success',
        response: 'Oi, tudo bem?',
      }),
    ]);
    expect(chatgpt.ask).toHaveBeenCalledWith(
      PING_AI_MESSAGE,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should fill every metric from the provider progress', async () => {
    const service = await createService([
      fakeProvider('chatgpt', answering('Olá!')),
    ]);

    const [result] = (await service.run()).results;

    expect(result.metrics).toEqual({
      pageLoadMs: expect.any(Number),
      timeToFirstTokenMs: expect.any(Number),
      responseTimeMs: expect.any(Number),
      totalTimeMs: expect.any(Number),
      responseLength: 4,
    });
  });

  it('should send a custom message when one is given', async () => {
    const chatgpt = fakeProvider('chatgpt', answering('Pizzaria X'));
    const service = await createService([chatgpt]);

    const result = await service.run('Melhores pizzarias em São Paulo?');

    expect(result.message).toBe('Melhores pizzarias em São Paulo?');
    expect(chatgpt.ask).toHaveBeenCalledWith(
      'Melhores pizzarias em São Paulo?',
      expect.anything(),
    );
  });

  it('should send "Oi!" when no message is given', async () => {
    const chatgpt = fakeProvider('chatgpt', answering('Olá!'));
    const service = await createService([chatgpt]);

    const result = await service.run(undefined);

    expect(result.message).toBe('Oi!');
    expect(chatgpt.ask).toHaveBeenCalledWith('Oi!', expect.anything());
  });

  it('should report how many attempts each provider needed', async () => {
    const service = await createService([
      fakeProvider('chatgpt', (_message, { progress }) => {
        progress.attemptStarted();
        progress.attemptStarted();
        progress.pageReady(false);
        return Promise.resolve('Olá!');
      }),
      fakeProvider('gemini', answering('Oi!')),
      fakeProvider('claude', (_message, { progress }) => {
        progress.attemptStarted();
        progress.attemptStarted();
        progress.attemptStarted();
        return Promise.reject(new Error('Cloudflare'));
      }),
    ]);

    const result = await service.run();

    expect(result.results.map((item) => item.attempts)).toEqual([2, 1, 3]);
  });

  it('should report whether each provider used a warm page', async () => {
    const service = await createService([
      fakeProvider('chatgpt', (_message, { progress }) => {
        progress.pageReady(true);
        return Promise.resolve('Olá!');
      }),
      fakeProvider('gemini', answering('Oi!')),
      fakeProvider('claude', () => Promise.reject(new Error('blocked'))),
    ]);

    const result = await service.run();

    expect(result.results.map((item) => item.warm)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('should report a blocked provider with the reason', async () => {
    const service = await createService([
      fakeProvider('chatgpt', () =>
        Promise.reject(new ChatBlockedError('chatgpt', 'captcha')),
      ),
    ]);

    const [result] = (await service.run()).results;

    expect(result).toMatchObject({
      status: 'blocked',
      blockReason: 'captcha',
      error: 'chatgpt blocked the access (captcha)',
    });
  });

  it('should keep the metrics reached before a failure', async () => {
    const service = await createService([
      fakeProvider('chatgpt', (_message, { progress }) => {
        progress.pageReady(false);
        return Promise.reject(new Error('blocked'));
      }),
    ]);

    const [result] = (await service.run()).results;

    expect(result.metrics.pageLoadMs).toEqual(expect.any(Number));
    expect(result.metrics.timeToFirstTokenMs).toBeNull();
    expect(result.metrics.responseTimeMs).toBeNull();
  });

  it('should keep the other providers running when one fails', async () => {
    const service = await createService([
      fakeProvider('chatgpt', () => Promise.reject(new Error('blocked'))),
      fakeProvider('gemini', answering('Oi!')),
    ]);

    const result = await service.run();

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        provider: 'chatgpt',
        status: 'error',
        error: 'blocked',
      }),
    );
    expect(result.results[1]).toEqual(
      expect.objectContaining({ provider: 'gemini', status: 'success' }),
    );
  });

  it('should mark a provider as timeout and abort it when it takes too long', async () => {
    let signal: AbortSignal | undefined;
    const service = await createService([
      fakeProvider('gemini', (_message, options) => {
        signal = options.signal;
        return new Promise(() => undefined);
      }),
    ]);

    const [result] = (await service.run()).results;

    expect(result.status).toBe('timeout');
    expect(result.error).toBe('Timeout after 100ms');
    expect(signal?.aborted).toBe(true);
  });
});
