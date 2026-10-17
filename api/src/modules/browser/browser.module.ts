import { Module } from '@nestjs/common';
import { BrowserService } from './browser.service.js';

@Module({
  providers: [BrowserService],
  exports: [BrowserService],
})
export class BrowserModule {}
