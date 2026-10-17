import { Page } from 'playwright';
import { AiChatProvider } from './ai-chat-provider.interface.js';

export interface ChatSelectors {
  input: string;
  send: string;
  response: string;
  busy: string;
}

const POLL_INTERVAL_MS = 250;
const STABLE_TEXT_MS = 1000;

export abstract class BaseChatProvider implements AiChatProvider {
  abstract readonly name: string;
  abstract readonly url: string;
  protected abstract readonly selectors: ChatSelectors;

  async waitUntilReady(page: Page): Promise<void> {
    await page.locator(this.selectors.input).first().waitFor();
  }

  async sendMessage(page: Page, message: string): Promise<void> {
    await page.locator(this.selectors.input).first().click();
    await page.keyboard.type(message);
    await page.locator(this.selectors.send).first().click();
  }

  async waitForFirstToken(page: Page): Promise<void> {
    await page.waitForFunction((selector) => {
      const responses = document.querySelectorAll(selector);
      const last = responses[responses.length - 1];
      return (last?.textContent ?? '').trim().length > 0;
    }, this.selectors.response);
  }

  async waitForResponse(page: Page): Promise<string> {
    const response = page.locator(this.selectors.response).last();
    let previous = '';
    let stableSince = Date.now();

    for (;;) {
      const text = (await response.innerText()).trim();
      const busy = (await page.locator(this.selectors.busy).count()) > 0;

      if (text !== previous) {
        previous = text;
        stableSince = Date.now();
      } else if (text && !busy && Date.now() - stableSince >= STABLE_TEXT_MS) {
        return text;
      }

      await page.waitForTimeout(POLL_INTERVAL_MS);
    }
  }
}
