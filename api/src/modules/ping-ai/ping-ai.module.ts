import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { pingAiConfig } from '../../config/ping-ai.config.js';
import { BrowserModule } from '../browser/browser.module.js';
import { buildChatChain, CHAT_CHAINS, type ChatChain } from './chat-chain.js';
import { PingAiController } from './ping-ai.controller.js';
import { PingAiService } from './ping-ai.service.js';
import {
  ChatPrewarmer,
  PREWARMED_CHAT_PROVIDERS,
} from './prewarm/chat-prewarmer.js';
import { AI_CHAT_PROVIDERS } from './providers/ai-chat-provider.interface.js';
import { ChatGptProvider } from './providers/chatgpt.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';

@Module({
  imports: [ConfigModule.forFeature(pingAiConfig), BrowserModule],
  controllers: [PingAiController],
  providers: [
    ChatGptProvider,
    GeminiProvider,
    {
      provide: CHAT_CHAINS,
      useFactory: (
        config: ConfigType<typeof pingAiConfig>,
        chatGpt: ChatGptProvider,
        gemini: GeminiProvider,
      ): ChatChain[] =>
        [chatGpt, gemini].map((site) => buildChatChain(site, config)),
      inject: [pingAiConfig.KEY, ChatGptProvider, GeminiProvider],
    },
    {
      provide: AI_CHAT_PROVIDERS,
      useFactory: (chains: ChatChain[]) =>
        chains.map((chain) => chain.provider),
      inject: [CHAT_CHAINS],
    },
    {
      provide: PREWARMED_CHAT_PROVIDERS,
      useFactory: (chains: ChatChain[]) =>
        chains.flatMap((chain) => (chain.prewarmed ? [chain.prewarmed] : [])),
      inject: [CHAT_CHAINS],
    },
    ChatPrewarmer,
    PingAiService,
  ],
})
export class PingAiModule {}
