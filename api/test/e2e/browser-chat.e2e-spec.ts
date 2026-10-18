import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { pingAiConfig } from '../../src/config/ping-ai.config.js';
import {
  BROWSER_SESSION_FACTORY,
  BrowserSessionFactory,
} from '../../src/modules/browser/browser-session.interface.js';
import { BrowserModule } from '../../src/modules/browser/browser.module.js';
import {
  ChatBlockedError,
  ChatNotReadyError,
} from '../../src/modules/ping-ai/errors/chat-errors.js';
import { BlockDetector } from '../../src/modules/ping-ai/providers/block-detector.js';
import {
  BrowserChatProvider,
  ChatSelectors,
} from '../../src/modules/ping-ai/providers/browser-chat.provider.js';

const E2E_TIMEOUT_MS = 60000;

function htmlPage(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

const PAGES = {
  chat: htmlPage(`
    <title>Fake Chat</title>
    <input id="input" />
    <button id="send" onclick="
      const answer = document.createElement('p');
      answer.className = 'answer';
      answer.textContent = 'Você disse: ' + document.getElementById('input').value;
      document.body.appendChild(answer);
    ">Enviar</button>
  `),
  captcha: htmlPage(`
    <title>Just a moment...</title>
    <p>Verifying you are human. This may take a few seconds.</p>
  `),
  rateLimit: htmlPage(`
    <title>Fake Chat</title>
    <p>You have reached the limit of messages for today.</p>
  `),
  empty: htmlPage(`<title>Fake Chat</title><p>Loading...</p>`),
};

class FakeChatProvider extends BrowserChatProvider {
  readonly name = 'fake';
  protected readonly selectors: ChatSelectors = {
    input: '#input',
    send: '#send',
    response: '.answer',
    busy: '.busy',
  };
  protected readonly blockers: BlockDetector[] = [
    { reason: 'captcha', title: /^just a moment/i },
    { reason: 'rate-limit', text: /reached the limit/i },
  ];

  constructor(
    protected readonly url: string,
    factory: BrowserSessionFactory,
  ) {
    super(factory, { ...pingAiConfig(), pageReadyTimeoutMs: 1500 });
  }
}

describe('BrowserChatProvider with a real browser (e2e)', () => {
  let module: TestingModule;
  let factory: BrowserSessionFactory;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), BrowserModule],
    }).compile();
    await module.init();
    factory = module.get<BrowserSessionFactory>(BROWSER_SESSION_FACTORY);
  }, E2E_TIMEOUT_MS);

  afterAll(async () => {
    await module.close();
  });

  it(
    'should answer on a working chat page',
    async () => {
      const chat = await new FakeChatProvider(PAGES.chat, factory).prepare();
      try {
        const answer = await chat.send('Oi!', {
          signal: new AbortController().signal,
          progress: {
            attemptStarted: () => undefined,
            pageReady: () => undefined,
            messageSent: () => undefined,
            firstToken: () => undefined,
          },
        });

        expect(answer).toBe('Você disse: Oi!');
      } finally {
        await chat.close();
      }
    },
    E2E_TIMEOUT_MS,
  );

  it.each([
    ['captcha', PAGES.captcha],
    ['rate-limit', PAGES.rateLimit],
  ])(
    'should detect a %s screen instead of waiting for the input',
    async (reason, page) => {
      const prepared = new FakeChatProvider(page, factory).prepare();

      await expect(prepared).rejects.toBeInstanceOf(ChatBlockedError);
      await expect(prepared).rejects.toMatchObject({ reason });
    },
    E2E_TIMEOUT_MS,
  );

  it(
    'should report that the input never appeared on a page without a block',
    async () => {
      await expect(
        new FakeChatProvider(PAGES.empty, factory).prepare(),
      ).rejects.toBeInstanceOf(ChatNotReadyError);
    },
    E2E_TIMEOUT_MS,
  );
});
