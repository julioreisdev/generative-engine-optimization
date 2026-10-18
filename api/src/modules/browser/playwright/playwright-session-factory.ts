import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { Browser, chromium } from 'playwright';
import { browserConfig } from '../../../config/browser.config.js';
import {
  BrowserSession,
  BrowserSessionFactory,
  BrowserSessionOptions,
} from '../browser-session.interface.js';
import { PlaywrightBrowserSession } from './playwright-browser-session.js';

interface LaunchedBrowser {
  browser: Browser;
  userAgent: string;
}

@Injectable()
export class PlaywrightSessionFactory
  implements BrowserSessionFactory, OnApplicationShutdown
{
  private launched: Promise<LaunchedBrowser> | null = null;
  private shutDown = false;

  constructor(
    @Inject(browserConfig.KEY)
    private readonly config: ConfigType<typeof browserConfig>,
  ) {}

  async createSession(options: BrowserSessionOptions): Promise<BrowserSession> {
    if (this.shutDown) {
      throw new Error('The browser is shut down');
    }
    const { browser, userAgent } = await this.getBrowser();
    const context = await browser.newContext({ locale: 'pt-BR', userAgent });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(options.timeoutMs);
      return new PlaywrightBrowserSession(context, page);
    } catch (error) {
      await context.close().catch(() => undefined);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.shutDown = true;
    const launched = this.launched;
    this.launched = null;
    const browser = await launched?.then(
      (result) => result.browser,
      () => null,
    );
    await browser?.close();
  }

  private getBrowser(): Promise<LaunchedBrowser> {
    if (!this.launched) {
      this.launched = this.launch().catch((error: unknown) => {
        this.launched = null;
        throw error;
      });
    }
    return this.launched;
  }

  private async launch(): Promise<LaunchedBrowser> {
    const browser = await chromium.launch({
      channel: this.config.channel,
      headless: this.config.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    browser.on('disconnected', () => {
      this.launched = null;
    });
    const userAgent = await this.resolveUserAgent(browser);
    return { browser, userAgent };
  }

  private async resolveUserAgent(browser: Browser): Promise<string> {
    const page = await browser.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await page.close();
    return userAgent.replace('HeadlessChrome', 'Chrome');
  }
}
