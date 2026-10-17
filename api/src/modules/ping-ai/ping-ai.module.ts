import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { pingAiConfig } from '../../config/ping-ai.config.js';
import { BrowserModule } from '../browser/browser.module.js';
import { PingAiController } from './ping-ai.controller.js';
import { PingAiService } from './ping-ai.service.js';
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
      provide: AI_CHAT_PROVIDERS,
      useFactory: (chatGpt: ChatGptProvider, gemini: GeminiProvider) => [
        chatGpt,
        gemini,
      ],
      inject: [ChatGptProvider, GeminiProvider],
    },
    PingAiService,
  ],
})
export class PingAiModule {}
