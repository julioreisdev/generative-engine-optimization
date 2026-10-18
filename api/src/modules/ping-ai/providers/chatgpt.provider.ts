import { Injectable } from '@nestjs/common';
import { BlockDetector } from './block-detector.js';
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
  protected readonly blockers: BlockDetector[] = [
    {
      reason: 'captcha',
      title: /^(um momento|just a moment)/i,
      text: /(verifique se você é humano|verify you are human)/i,
    },
    {
      reason: 'login',
      url: /(auth\.openai\.com|\/auth\/login)/,
    },
    {
      reason: 'rate-limit',
      text: /(atingiu o limite|reached (the|your) limit|too many requests|muitas solicitações)/i,
    },
  ];
}
