import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { OperationTimeoutError } from '../../src/common/with-timeout.js';
import {
  BROWSER_SESSION_FACTORY,
  BrowserSession,
  BrowserSessionFactory,
} from '../../src/modules/browser/browser-session.interface.js';
import { BrowserModule } from '../../src/modules/browser/browser.module.js';

const E2E_TIMEOUT_MS = 60000;

const FAKE_CHAT_PAGE = `data:text/html;charset=utf-8,${encodeURIComponent(`
  <input id="input" />
  <button id="send" onclick="
    const answer = document.createElement('p');
    answer.className = 'answer';
    document.body.appendChild(answer);
    const busy = document.createElement('span');
    busy.className = 'busy';
    document.body.appendChild(busy);
    setTimeout(() => {
      answer.textContent = 'Você disse: ' + document.getElementById('input').value;
      busy.remove();
    }, 300);
  ">Enviar</button>
`)}`;

describe('BrowserModule (e2e)', () => {
  let module: TestingModule;
  let factory: BrowserSessionFactory;
  let session: BrowserSession;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), BrowserModule],
    }).compile();
    await module.init();
    factory = module.get<BrowserSessionFactory>(BROWSER_SESSION_FACTORY);
  }, E2E_TIMEOUT_MS);

  beforeEach(async () => {
    session = await factory.createSession({ timeoutMs: 5000 });
  });

  afterEach(async () => {
    await session.close();
  });

  afterAll(async () => {
    await module.close();
  });

  it(
    'should drive a real chat-like page through the BrowserSession interface',
    async () => {
      await session.open(FAKE_CHAT_PAGE);
      await session.waitForVisible('#input');
      await session.click('#input');
      await session.type('Oi!');
      await session.click('#send');

      await expect(session.exists('.busy')).resolves.toBe(true);
      await session.waitForText('.answer');
      await expect(session.lastText('.answer')).resolves.toBe(
        'Você disse: Oi!',
      );
      await expect(session.exists('.busy')).resolves.toBe(false);
    },
    E2E_TIMEOUT_MS,
  );

  it(
    'should throw OperationTimeoutError when an element never shows up',
    async () => {
      const shortSession = await factory.createSession({ timeoutMs: 300 });
      await shortSession.open(FAKE_CHAT_PAGE);

      await expect(
        shortSession.waitForVisible('#does-not-exist'),
      ).rejects.toBeInstanceOf(OperationTimeoutError);
      await shortSession.close();
    },
    E2E_TIMEOUT_MS,
  );
});
