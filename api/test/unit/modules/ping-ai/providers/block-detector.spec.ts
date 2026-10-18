import {
  BlockDetector,
  findBlock,
} from '../../../../../src/modules/ping-ai/providers/block-detector.js';
import { ChatGptProvider } from '../../../../../src/modules/ping-ai/providers/chatgpt.provider.js';
import { GeminiProvider } from '../../../../../src/modules/ping-ai/providers/gemini.provider.js';

const page = { url: 'https://chat.test/', title: 'Chat', text: 'Olá' };

describe('findBlock', () => {
  const detectors: BlockDetector[] = [
    { reason: 'captcha', title: /^just a moment/i },
    { reason: 'login', url: /\/login/ },
    { reason: 'rate-limit', text: /reached the limit/i },
  ];

  it('should find nothing on a normal page', () => {
    expect(findBlock(page, detectors)).toBeNull();
  });

  it('should match by title, url or text', () => {
    expect(findBlock({ ...page, title: 'Just a moment...' }, detectors)).toBe(
      'captcha',
    );
    expect(
      findBlock({ ...page, url: 'https://chat.test/login' }, detectors),
    ).toBe('login');
    expect(
      findBlock({ ...page, text: 'You reached the limit' }, detectors),
    ).toBe('rate-limit');
  });

  it('should return the first matching detector', () => {
    expect(
      findBlock(
        { ...page, title: 'Just a moment...', url: 'https://chat.test/login' },
        detectors,
      ),
    ).toBe('captcha');
  });
});

describe('site block detectors', () => {
  function blockersOf(
    Provider: typeof ChatGptProvider | typeof GeminiProvider,
  ) {
    const provider = new Provider({ createSession: vi.fn() }, {} as never);
    return (provider as unknown as { blockers: BlockDetector[] }).blockers;
  }

  it.each([
    [{ title: 'Um momento…' }, 'captcha'],
    [{ title: 'Just a moment...' }, 'captcha'],
    [{ url: 'https://auth.openai.com/log-in' }, 'login'],
    [{ text: 'Você atingiu o limite de mensagens' }, 'rate-limit'],
    [{ title: 'ChatGPT: Chat, Work, Create & Code with AI' }, null],
  ])('ChatGPT: %o should be %s', (snapshot, reason) => {
    expect(
      findBlock({ ...page, ...snapshot }, blockersOf(ChatGptProvider)),
    ).toBe(reason);
  });

  it.each([
    [{ url: 'https://www.google.com/sorry/index?continue=x' }, 'captcha'],
    [{ text: 'Nossos sistemas detectaram tráfego incomum' }, 'captcha'],
    [{ url: 'https://accounts.google.com/v3/signin' }, 'login'],
    [
      { title: 'Google Gemini', text: 'Fazer login\nConversa com o Gemini' },
      null,
    ],
  ])('Gemini: %o should be %s', (snapshot, reason) => {
    expect(
      findBlock({ ...page, ...snapshot }, blockersOf(GeminiProvider)),
    ).toBe(reason);
  });
});
