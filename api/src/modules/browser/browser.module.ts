import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { browserConfig } from '../../config/browser.config.js';
import { BROWSER_SESSION_FACTORY } from './browser-session.interface.js';
import { PlaywrightSessionFactory } from './playwright/playwright-session-factory.js';

@Module({
  imports: [ConfigModule.forFeature(browserConfig)],
  providers: [
    { provide: BROWSER_SESSION_FACTORY, useClass: PlaywrightSessionFactory },
  ],
  exports: [BROWSER_SESSION_FACTORY],
})
export class BrowserModule {}
