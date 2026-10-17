import { Module } from '@nestjs/common';
import { PingController } from './ping.controller.js';
import { PingService } from './ping.service.js';

@Module({
  controllers: [PingController],
  providers: [PingService],
})
export class PingModule {}
