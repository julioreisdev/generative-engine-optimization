import { Injectable } from '@nestjs/common';
import { BrowserChatProvider, ChatSelectors } from './browser-chat.provider.js';

@Injectable()
export class ChatGptProvider extends BrowserChatProvider {
  readonly name = 'chatgpt';
  protected readonly url = 'https://chatgpt.com/';
  protected readonly selectors: ChatSelectors = {
    input: '#prompt-textarea, #mobile-composer-prompt',
    send: 'button[data-testid="send-button"], button[aria-label="Enviar mensagem"]',
    response: '[data-assistant-markdown-root]',
    busy: 'button[data-testid="stop-button"], button[aria-label="Interromper geração"], [data-assistant-markdown-root] [aria-busy="true"]',
  };
}
