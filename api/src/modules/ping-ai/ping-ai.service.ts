import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { Stopwatch } from '../../common/stopwatch.js';
import { withTimeout } from '../../common/with-timeout.js';
import { pingAiConfig } from '../../config/ping-ai.config.js';
import { classifyError } from './classify-error.js';
import {
  PingAiResponseDto,
  PingAiResultDto,
} from './dto/ping-ai-response.dto.js';
import { MetricsRecorder } from './metrics/metrics-recorder.js';
import {
  AI_CHAT_PROVIDERS,
  type AiChatProvider,
} from './providers/ai-chat-provider.interface.js';

export const PING_AI_MESSAGE = 'Oi!';

@Injectable()
export class PingAiService {
  private readonly timeoutMs: number;

  constructor(
    @Inject(AI_CHAT_PROVIDERS) private readonly providers: AiChatProvider[],
    @Inject(pingAiConfig.KEY) config: ConfigType<typeof pingAiConfig>,
  ) {
    this.timeoutMs = config.timeoutMs;
  }

  async run(message: string = PING_AI_MESSAGE): Promise<PingAiResponseDto> {
    const startedAt = new Date().toISOString();
    const stopwatch = new Stopwatch();
    const results = await Promise.all(
      this.providers.map((provider) => this.runProvider(provider, message)),
    );
    return {
      message,
      startedAt,
      totalTimeMs: stopwatch.elapsedMs(),
      results,
    };
  }

  private async runProvider(
    provider: AiChatProvider,
    message: string,
  ): Promise<PingAiResultDto> {
    const recorder = new MetricsRecorder();
    const controller = new AbortController();

    try {
      const response = await withTimeout(
        provider.ask(message, {
          signal: controller.signal,
          progress: recorder,
        }),
        this.timeoutMs,
      );
      recorder.responseReceived(response);
      return {
        provider: provider.name,
        status: 'success',
        warm: recorder.warm,
        response,
        metrics: recorder.finish(),
      };
    } catch (error) {
      const { status, message } = classifyError(error);
      return {
        provider: provider.name,
        status,
        warm: recorder.warm,
        error: message,
        metrics: recorder.finish(),
      };
    } finally {
      controller.abort();
    }
  }
}
