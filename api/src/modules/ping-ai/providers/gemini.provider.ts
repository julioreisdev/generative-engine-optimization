import { Injectable } from '@nestjs/common';
import { BaseChatProvider, ChatSelectors } from './base-chat.provider.js';

@Injectable()
export class GeminiProvider extends BaseChatProvider {
  readonly name = 'gemini';
  readonly url = 'https://gemini.google.com/app';
  protected readonly selectors: ChatSelectors = {
    input: '.ql-editor[contenteditable="true"]',
    send: 'button.send-button, button[aria-label="Enviar mensagem"]',
    response: '[id^="model-response-message-content"]',
    busy: '[id^="model-response-message-content"][aria-busy="true"]',
  };
}
