import { Injectable } from '@nestjs/common';
import { BrowserChatProvider, ChatSelectors } from './browser-chat.provider.js';

@Injectable()
export class GeminiProvider extends BrowserChatProvider {
  readonly name = 'gemini';
  protected readonly url = 'https://gemini.google.com/app';
  protected readonly selectors: ChatSelectors = {
    input: '.ql-editor[contenteditable="true"]',
    send: 'button.send-button, button[aria-label="Enviar mensagem"]',
    response: '[id^="model-response-message-content"]',
    busy: '[id^="model-response-message-content"][aria-busy="true"]',
  };
}
