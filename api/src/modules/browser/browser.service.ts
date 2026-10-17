import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Browser, BrowserContext, chromium } from 'playwright';

interface LaunchedBrowser {
  browser: Browser;
  userAgent: string;
}

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private launched: Promise<LaunchedBrowser> | null = null;

  async newContext(): Promise<BrowserContext> {
    const { browser, userAgent } = await this.getBrowser();
    return browser.newContext({ locale: 'pt-BR', userAgent });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.launched) {
      return;
    }
    const { browser } = await this.launched;
    this.launched = null;
    await browser.close();
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
      channel: process.env.BROWSER_CHANNEL ?? 'chrome',
      headless: process.env.BROWSER_HEADLESS !== 'false',
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
