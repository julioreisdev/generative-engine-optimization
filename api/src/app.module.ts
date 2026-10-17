import { Module } from '@nestjs/common';
import { PingAiModule } from './modules/ping-ai/ping-ai.module.js';
import { PingModule } from './modules/ping/ping.module.js';

@Module({
  imports: [PingModule, PingAiModule],
})
export class AppModule {}
