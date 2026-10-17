import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PingAiResponseDto } from '../../src/modules/ping-ai/dto/ping-ai-response.dto.js';

const E2E_TIMEOUT_MS = 150000;

describe('PingAiController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    '/ping-ai (GET) should return the real answers from ChatGPT and Gemini',
    async () => {
      const { body } = await request(app.getHttpServer())
        .get('/ping-ai')
        .expect(200);
      const result = body as PingAiResponseDto;

      expect(result.message).toBe('Oi!');
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
        expect(item.metrics.responseLength).toBe(item.response?.length);
        expect(item.metrics.pageLoadMs).toBeGreaterThan(0);
        expect(item.metrics.timeToFirstTokenMs).toBeGreaterThan(0);
        expect(item.metrics.responseTimeMs).toBeGreaterThanOrEqual(
          item.metrics.timeToFirstTokenMs ?? 0,
        );
        expect(item.metrics.totalTimeMs).toBeGreaterThan(0);
      }
    },
    E2E_TIMEOUT_MS,
  );
});
