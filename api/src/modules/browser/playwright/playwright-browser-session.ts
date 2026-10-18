import { BrowserContext, errors, Page } from 'playwright';
import { OperationTimeoutError } from '../../../common/with-timeout.js';
import { BrowserSession, PageSnapshot } from '../browser-session.interface.js';

export class PlaywrightBrowserSession implements BrowserSession {
  constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  async open(url: string): Promise<void> {
    await this.run(() =>
      this.page.goto(url, { waitUntil: 'domcontentloaded' }),
    );
  }

  async waitForVisible(selector: string, timeoutMs?: number): Promise<void> {
    await this.run(() =>
      this.page.locator(selector).first().waitFor({ timeout: timeoutMs }),
    );
  }

  async click(selector: string): Promise<void> {
    await this.run(() => this.page.locator(selector).first().click());
  }

  async type(text: string): Promise<void> {
    await this.run(() => this.page.keyboard.insertText(text));
  }

  async waitForText(selector: string): Promise<void> {
    await this.run(() =>
      this.page.waitForFunction((target) => {
        const elements = document.querySelectorAll(target);
        const last = elements[elements.length - 1];
        return (last?.textContent ?? '').trim().length > 0;
      }, selector),
    );
  }

  lastText(selector: string): Promise<string> {
    return this.run(() => this.page.locator(selector).last().innerText());
  }

  async exists(selector: string): Promise<boolean> {
    const count = await this.run(() => this.page.locator(selector).count());
    return count > 0;
  }

  inspect(): Promise<PageSnapshot> {
    return this.run(async () => ({
      url: this.page.url(),
      title: await this.page.title(),
      text: await this.page.evaluate(() => document.body?.innerText ?? ''),
    }));
  }

  async pause(ms: number): Promise<void> {
    await this.run(() => this.page.waitForTimeout(ms));
  }

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined);
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof errors.TimeoutError) {
        throw new OperationTimeoutError(error.message);
      }
      throw error;
    }
  }
}
