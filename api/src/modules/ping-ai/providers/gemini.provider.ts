import { Injectable } from '@nestjs/common';
import { BlockDetector } from './block-detector.js';
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
  protected readonly blockers: BlockDetector[] = [
    {
      reason: 'captcha',
      url: /google\.com\/sorry/,
      text: /(tráfego incomum|unusual traffic)/i,
    },
    {
      reason: 'login',
      url: /accounts\.google\.com/,
    },
    {
      reason: 'rate-limit',
      text: /(atingiu o limite|reached (the|your) limit|limite de uso)/i,
    },
  ];
}
