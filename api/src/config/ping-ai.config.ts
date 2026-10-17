import { registerAs } from '@nestjs/config';
import { parsePositiveInt } from './env.js';

export const pingAiConfig = registerAs('pingAi', () => ({
  timeoutMs: parsePositiveInt(process.env.PING_AI_TIMEOUT_MS, 90000),
}));
