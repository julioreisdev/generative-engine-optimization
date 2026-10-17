import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config.js';
import { PingAiModule } from './modules/ping-ai/ping-ai.module.js';
import { PingModule } from './modules/ping/ping.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    PingModule,
    PingAiModule,
  ],
})
export class AppModule {}
