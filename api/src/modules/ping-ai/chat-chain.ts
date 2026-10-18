import { type ConfigType } from '@nestjs/config';
import { CircuitBreaker } from '../../common/circuit-breaker.js';
import { pingAiConfig } from '../../config/ping-ai.config.js';
import { PrewarmedChatProvider } from './prewarm/prewarmed-chat.provider.js';
import {
  AiChatProvider,
  PreparableChatProvider,
} from './providers/ai-chat-provider.interface.js';
import { CircuitBreakerChatProvider } from './resilience/circuit-breaker-chat.provider.js';
import { RetryingChatProvider } from './resilience/retrying-chat.provider.js';

export const CHAT_CHAINS = Symbol('CHAT_CHAINS');

export interface ChatChain {
  provider: AiChatProvider;
  prewarmed: PrewarmedChatProvider | null;
}

export function buildChatChain(
  site: PreparableChatProvider,
  config: ConfigType<typeof pingAiConfig>,
): ChatChain {
  const retrying = new RetryingChatProvider(site, {
    attempts: config.retryAttempts,
    backoffMs: config.retryBackoffMs,
  });
  const breaker = new CircuitBreaker({
    failureThreshold: config.breakerFailures,
    cooldownMs: config.breakerCooldownMs,
  });
  const prewarmed = config.prewarm
    ? new PrewarmedChatProvider(retrying, {
        refreshMs: config.prewarmRefreshMs,
        gate: breaker,
      })
    : null;
  return {
    provider: new CircuitBreakerChatProvider(prewarmed ?? retrying, breaker),
    prewarmed,
  };
}
