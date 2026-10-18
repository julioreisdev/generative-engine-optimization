import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { pingAiConfig } from '../../src/config/ping-ai.config.js';
import { PingAiResponseDto } from '../../src/modules/ping-ai/dto/ping-ai-response.dto.js';
import { ChatBlockedError } from '../../src/modules/ping-ai/errors/chat-errors.js';
import {
  AskOptions,
  PreparableChatProvider,
  PreparedChat,
} from '../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';
import { ChatGptProvider } from '../../src/modules/ping-ai/providers/chatgpt.provider.js';
import { GeminiProvider } from '../../src/modules/ping-ai/providers/gemini.provider.js';

const blockedChatGpt: PreparableChatProvider = {
  name: 'chatgpt',
  prepare: () => Promise.reject(new ChatBlockedError('chatgpt', 'captcha')),
  ask: () => Promise.reject(new Error('not used')),
};

const workingGemini: PreparableChatProvider = {
  name: 'gemini',
  prepare: (): Promise<PreparedChat> =>
    Promise.resolve({
      send: (_message: string, { progress }: AskOptions) => {
        progress.messageSent();
        progress.firstToken();
        return Promise.resolve('Olá!');
      },
      close: () => Promise.resolve(),
    }),
  ask: () => Promise.reject(new Error('not used')),
};

describe('PingAiController resilience (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(pingAiConfig.KEY)
      .useValue({
        ...pingAiConfig(),
        prewarm: false,
        breakerFailures: 2,
        breakerCooldownMs: 300000,
      })
      .overrideProvider(ChatGptProvider)
      .useValue(blockedChatGpt)
      .overrideProvider(GeminiProvider)
      .useValue(workingGemini)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function callPingAi(): Promise<PingAiResponseDto> {
    const { body } = await request(app.getHttpServer())
      .get('/ping-ai')
      .expect(200);
    return body as PingAiResponseDto;
  }

  it('should report the block, then pause the blocked site while the other keeps answering', async () => {
    const first = await callPingAi();
    const second = await callPingAi();
    const third = await callPingAi();

    for (const result of [first, second]) {
      expect(result.results[0]).toMatchObject({
        provider: 'chatgpt',
        status: 'blocked',
        blockReason: 'captcha',
        attempts: 1,
      });
    }
    expect(third.results[0]).toMatchObject({
      provider: 'chatgpt',
      status: 'unavailable',
    });
    expect(third.results[0].error).toMatch(
      /chatgpt is paused after consecutive failures. Next try in \d+s/,
    );
    expect(third.results[0].metrics.totalTimeMs).toBeLessThan(50);

    for (const result of [first, second, third]) {
      expect(result.results[1]).toMatchObject({
        provider: 'gemini',
        status: 'success',
        response: 'Olá!',
      });
    }
  });
});
