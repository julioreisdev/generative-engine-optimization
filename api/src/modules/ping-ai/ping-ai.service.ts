import { Inject, Injectable } from '@nestjs/common';
import { BrowserContext, errors } from 'playwright';
import {
  OperationTimeoutError,
  withTimeout,
} from '../../common/with-timeout.js';
import { BrowserService } from '../browser/browser.service.js';
import {
  PingAiMetricsDto,
  PingAiResponseDto,
  PingAiResultDto,
} from './dto/ping-ai-response.dto.js';
import {
  AI_CHAT_PROVIDERS,
  type AiChatProvider,
} from './providers/ai-chat-provider.interface.js';

export const PING_AI_MESSAGE = 'Oi!';
const DEFAULT_TIMEOUT_MS = 90000;

@Injectable()
export class PingAiService {
  private readonly timeoutMs = Number(
    process.env.PING_AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );

  constructor(
    private readonly browserService: BrowserService,
    @Inject(AI_CHAT_PROVIDERS) private readonly providers: AiChatProvider[],
  ) {}

  async run(): Promise<PingAiResponseDto> {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const results = await Promise.all(
      this.providers.map((provider) => this.runProvider(provider)),
    );
    return {
      message: PING_AI_MESSAGE,
      startedAt,
      totalTimeMs: elapsedSince(start),
      results,
    };
  }

  private async runProvider(
    provider: AiChatProvider,
  ): Promise<PingAiResultDto> {
    const start = performance.now();
    const metrics: PingAiMetricsDto = {
      pageLoadMs: null,
      timeToFirstTokenMs: null,
      responseTimeMs: null,
      totalTimeMs: 0,
      responseLength: 0,
    };
    let context: BrowserContext | undefined;

    try {
      context = await this.browserService.newContext();
      const response = await withTimeout(
        this.ask(provider, context, metrics, start),
        this.timeoutMs,
      );
      metrics.responseLength = response.length;
      return { provider: provider.name, status: 'success', response, metrics };
    } catch (error) {
      return {
        provider: provider.name,
        status: isTimeout(error) ? 'timeout' : 'error',
        error: error instanceof Error ? error.message : String(error),
        metrics,
      };
    } finally {
      metrics.totalTimeMs = elapsedSince(start);
      await context?.close().catch(() => undefined);
    }
  }

  private async ask(
    provider: AiChatProvider,
    context: BrowserContext,
    metrics: PingAiMetricsDto,
    start: number,
  ): Promise<string> {
    const page = await context.newPage();
    page.setDefaultTimeout(this.timeoutMs);

    await page.goto(provider.url, { waitUntil: 'domcontentloaded' });
    await provider.waitUntilReady(page);
    metrics.pageLoadMs = elapsedSince(start);

    await provider.sendMessage(page, PING_AI_MESSAGE);
    const sentAt = performance.now();

    await provider.waitForFirstToken(page);
    metrics.timeToFirstTokenMs = elapsedSince(sentAt);

    const response = await provider.waitForResponse(page);
    metrics.responseTimeMs = elapsedSince(sentAt);

    return response;
  }
}

function elapsedSince(start: number): number {
  return Math.round(performance.now() - start);
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof OperationTimeoutError ||
    error instanceof errors.TimeoutError
  );
}
