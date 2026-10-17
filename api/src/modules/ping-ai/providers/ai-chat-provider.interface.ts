import { Page } from 'playwright';

export const AI_CHAT_PROVIDERS = Symbol('AI_CHAT_PROVIDERS');

export interface AiChatProvider {
  readonly name: string;
  readonly url: string;
  waitUntilReady(page: Page): Promise<void>;
  sendMessage(page: Page, message: string): Promise<void>;
  waitForFirstToken(page: Page): Promise<void>;
  waitForResponse(page: Page): Promise<string>;
}
