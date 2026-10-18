import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { pingAiConfig } from '../../config/ping-ai.config.js';
import { BrowserModule } from '../browser/browser.module.js';
import { PingAiController } from './ping-ai.controller.js';
import { PingAiService } from './ping-ai.service.js';
import { ChatPrewarmer } from './prewarm/chat-prewarmer.js';
import { PrewarmedChatProvider } from './prewarm/prewarmed-chat.provider.js';
import {
  AI_CHAT_PROVIDERS,
  type AiChatProvider,
  type PreparableChatProvider,
} from './providers/ai-chat-provider.interface.js';
import { ChatGptProvider } from './providers/chatgpt.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';

function withPrewarm(
  config: ConfigType<typeof pingAiConfig>,
  providers: PreparableChatProvider[],
): AiChatProvider[] {
  if (!config.prewarm) {
    return providers;
  }
  return providers.map(
    (provider) =>
      new PrewarmedChatProvider(provider, {
        refreshMs: config.prewarmRefreshMs,
      }),
  );
}

@Module({
  imports: [ConfigModule.forFeature(pingAiConfig), BrowserModule],
  controllers: [PingAiController],
  providers: [
    ChatGptProvider,
    GeminiProvider,
    {
      provide: AI_CHAT_PROVIDERS,
      useFactory: (
        config: ConfigType<typeof pingAiConfig>,
        chatGpt: ChatGptProvider,
        gemini: GeminiProvider,
      ) => withPrewarm(config, [chatGpt, gemini]),
      inject: [pingAiConfig.KEY, ChatGptProvider, GeminiProvider],
    },
    ChatPrewarmer,
    PingAiService,
  ],
})
export class PingAiModule {}
