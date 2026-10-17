import { Test } from '@nestjs/testing';
import { BrowserService } from '../../../../src/modules/browser/browser.service.js';
import {
  PING_AI_MESSAGE,
  PingAiService,
} from '../../../../src/modules/ping-ai/ping-ai.service.js';
import {
  AI_CHAT_PROVIDERS,
  AiChatProvider,
} from '../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';

function fakeProvider(
  name: string,
  waitForResponse: () => Promise<string>,
): AiChatProvider {
  return {
    name,
    url: `https://${name}.test/`,
    waitUntilReady: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    waitForFirstToken: vi.fn().mockResolvedValue(undefined),
    waitForResponse: vi.fn(waitForResponse),
  };
}

describe('PingAiService', () => {
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    setDefaultTimeout: vi.fn(),
  };
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const browserService = {
    newContext: vi.fn().mockResolvedValue(context),
  };

  async function createService(providers: AiChatProvider[]) {
    const module = await Test.createTestingModule({
      providers: [
        PingAiService,
        { provide: BrowserService, useValue: browserService },
        { provide: AI_CHAT_PROVIDERS, useValue: providers },
      ],
    }).compile();
    return module.get(PingAiService);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PING_AI_TIMEOUT_MS = '100';
  });

  afterAll(() => {
    delete process.env.PING_AI_TIMEOUT_MS;
  });

  it('should send the message to every provider and return their answers', async () => {
    const chatgpt = fakeProvider('chatgpt', () => Promise.resolve('Olá!'));
    const gemini = fakeProvider('gemini', () =>
      Promise.resolve('Oi, tudo bem?'),
    );
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
    expect(chatgpt.sendMessage).toHaveBeenCalledWith(page, PING_AI_MESSAGE);
    expect(page.goto).toHaveBeenCalledWith('https://gemini.test/', {
      waitUntil: 'domcontentloaded',
    });
  });

  it('should fill every metric on success', async () => {
    const service = await createService([
      fakeProvider('chatgpt', () => Promise.resolve('Olá!')),
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

  it('should keep the other providers running when one fails', async () => {
    const service = await createService([
      fakeProvider('chatgpt', () => Promise.reject(new Error('blocked'))),
      fakeProvider('gemini', () => Promise.resolve('Oi!')),
    ]);

    const result = await service.run();

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        provider: 'chatgpt',
        status: 'error',
        error: 'blocked',
      }),
    );
    expect(result.results[0].metrics.responseTimeMs).toBeNull();
    expect(result.results[1]).toEqual(
      expect.objectContaining({ provider: 'gemini', status: 'success' }),
    );
  });

  it('should mark a provider as timeout when it takes too long', async () => {
    const service = await createService([
      fakeProvider('gemini', () => new Promise(() => undefined)),
    ]);

    const [result] = (await service.run()).results;

    expect(result.status).toBe('timeout');
    expect(result.error).toBe('Timeout after 100ms');
  });

  it('should close every browser context', async () => {
    const service = await createService([
      fakeProvider('chatgpt', () => Promise.resolve('Olá!')),
      fakeProvider('gemini', () => Promise.reject(new Error('blocked'))),
    ]);

    await service.run();

    expect(context.close).toHaveBeenCalledTimes(2);
  });
});
