import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { pingAiConfig } from '../../src/config/ping-ai.config.js';
import { PING_AI_MESSAGE_MAX_LENGTH } from '../../src/modules/ping-ai/dto/ping-ai-query.dto.js';
import { PingAiResponseDto } from '../../src/modules/ping-ai/dto/ping-ai-response.dto.js';
import { ChatPrewarmer } from '../../src/modules/ping-ai/prewarm/chat-prewarmer.js';

const E2E_TIMEOUT_MS = 150000;

async function createApp(prewarm: boolean): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(pingAiConfig.KEY)
    .useValue({ ...pingAiConfig(), prewarm })
    .compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}

async function callPingAi(
  app: INestApplication<App>,
  message?: string,
): Promise<PingAiResponseDto> {
  const { body } = await request(app.getHttpServer())
    .get('/ping-ai')
    .query(message === undefined ? {} : { message })
    .expect(200);
  const result = body as PingAiResponseDto;

  expect(result.message).toBe(message ?? 'Oi!');
  expect(result.totalTimeMs).toBeGreaterThan(0);
  expect(result.results.map((item) => item.provider)).toEqual([
    'chatgpt',
    'gemini',
  ]);

  for (const item of result.results) {
    expect(item, `${item.provider}: ${item.error}`).toMatchObject({
      status: 'success',
    });
    expect(item.response?.length).toBeGreaterThan(0);
    expect(item.attempts).toBeGreaterThanOrEqual(1);
    expect(item.metrics.responseLength).toBe(item.response?.length);
    expect(item.metrics.pageLoadMs).toBeGreaterThanOrEqual(0);
    expect(item.metrics.timeToFirstTokenMs).toBeGreaterThan(0);
    expect(item.metrics.responseTimeMs).toBeGreaterThanOrEqual(
      item.metrics.timeToFirstTokenMs ?? 0,
    );
    expect(item.metrics.totalTimeMs).toBeGreaterThan(0);
  }

  return result;
}

describe('PingAiController (e2e)', () => {
  describe('without prewarm', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp(false);
    });

    afterAll(async () => {
      await app.close();
    });

    it(
      '/ping-ai (GET) should open the chats cold and return the real answers',
      async () => {
        const result = await callPingAi(app);

        expect(result.results.map((item) => item.warm)).toEqual([false, false]);
      },
      E2E_TIMEOUT_MS,
    );

    it.each([
      ['blank', '   '],
      ['too long', 'a'.repeat(PING_AI_MESSAGE_MAX_LENGTH + 1)],
    ])(
      '/ping-ai (GET) should reject a %s message without opening any chat',
      async (_case, message) => {
        await request(app.getHttpServer())
          .get('/ping-ai')
          .query({ message })
          .expect(400);
      },
    );
  });

  describe('with prewarm', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp(true);
      await app.get(ChatPrewarmer).ready();
    }, E2E_TIMEOUT_MS);

    afterAll(async () => {
      await app.close();
    });

    it(
      '/ping-ai (GET) should send a custom multi-line message through the warm pages',
      async () => {
        const result = await callPingAi(
          app,
          'Responda apenas com a palavra AZUL.\nDepois, na linha de baixo, a palavra VERDE.',
        );

        for (const item of result.results) {
          expect(item.response?.toUpperCase()).toContain('AZUL');
          expect(item.response?.toUpperCase()).toContain('VERDE');
        }

        expect(result.results.map((item) => item.warm)).toEqual([true, true]);
        for (const item of result.results) {
          expect(item.metrics.pageLoadMs).toBeLessThan(1000);
        }
      },
      E2E_TIMEOUT_MS,
    );
  });
});
