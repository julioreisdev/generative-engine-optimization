import { registerAs } from '@nestjs/config';
import { parseBoolean, parsePositiveInt } from './env.js';

export const pingAiConfig = registerAs('pingAi', () => ({
  timeoutMs: parsePositiveInt(process.env.PING_AI_TIMEOUT_MS, 90000),
  prewarm: parseBoolean(process.env.PING_AI_PREWARM, true),
  prewarmRefreshMs: parsePositiveInt(
    process.env.PING_AI_PREWARM_REFRESH_MS,
    600000,
  ),
}));
