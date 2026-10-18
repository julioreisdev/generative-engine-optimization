import { registerAs } from '@nestjs/config';
import { parseBoolean, parsePositiveInt } from './env.js';

export const pingAiConfig = registerAs('pingAi', () => ({
  timeoutMs: parsePositiveInt(process.env.PING_AI_TIMEOUT_MS, 90000),
  pageReadyTimeoutMs: parsePositiveInt(
    process.env.PING_AI_PAGE_READY_TIMEOUT_MS,
    25000,
  ),
  prewarm: parseBoolean(process.env.PING_AI_PREWARM, true),
  prewarmRefreshMs: parsePositiveInt(
    process.env.PING_AI_PREWARM_REFRESH_MS,
    600000,
  ),
  retryAttempts: parsePositiveInt(process.env.PING_AI_RETRY_ATTEMPTS, 3),
  retryBackoffMs: parsePositiveInt(process.env.PING_AI_RETRY_BACKOFF_MS, 1000),
  breakerFailures: parsePositiveInt(process.env.PING_AI_BREAKER_FAILURES, 3),
  breakerCooldownMs: parsePositiveInt(
    process.env.PING_AI_BREAKER_COOLDOWN_MS,
    300000,
  ),
}));
