import { Test } from '@nestjs/testing';
import { pingAiConfig } from '../../../../src/config/ping-ai.config.js';
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
    progress.pageReady();
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

  it('should keep the metrics reached before a failure', async () => {
    const service = await createService([
      fakeProvider('chatgpt', (_message, { progress }) => {
        progress.pageReady();
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
