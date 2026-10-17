import { Module } from '@nestjs/common';
import { PingModule } from './modules/ping/ping.module.js';

@Module({
  imports: [PingModule],
})
export class AppModule {}
