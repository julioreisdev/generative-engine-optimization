import { chromium } from 'playwright';
import { PlaywrightBrowserSession } from '../../../../../src/modules/browser/playwright/playwright-browser-session.js';
import { PlaywrightSessionFactory } from '../../../../../src/modules/browser/playwright/playwright-session-factory.js';

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn() },
  errors: { TimeoutError: class extends Error {} },
}));

describe('PlaywrightSessionFactory', () => {
  const page = { setDefaultTimeout: vi.fn() };
  const context = {
    newPage: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const probePage = {
    evaluate: vi
      .fn()
      .mockResolvedValue('Mozilla/5.0 HeadlessChrome/150.0.0.0 Safari/537.36'),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    newPage: vi.fn().mockResolvedValue(probePage),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
  let factory: PlaywrightSessionFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    context.newPage.mockResolvedValue(page);
    vi.mocked(chromium.launch).mockResolvedValue(browser as never);
    factory = new PlaywrightSessionFactory({
      headless: false,
      channel: 'msedge',
    });
  });

  it('should launch the browser with the injected config', async () => {
    await factory.createSession({ timeoutMs: 1000 });

    expect(chromium.launch).toHaveBeenCalledWith(
      expect.objectContaining({ headless: false, channel: 'msedge' }),
    );
  });

  it('should create an isolated pt-BR context with a non-headless user agent', async () => {
    await factory.createSession({ timeoutMs: 1000 });

    expect(browser.newContext).toHaveBeenCalledWith({
      locale: 'pt-BR',
      userAgent: 'Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36',
    });
  });

  it('should return a Playwright session with the requested timeout', async () => {
    const session = await factory.createSession({ timeoutMs: 1234 });

    expect(session).toBeInstanceOf(PlaywrightBrowserSession);
    expect(page.setDefaultTimeout).toHaveBeenCalledWith(1234);
  });

  it('should close the context when the page cannot be created', async () => {
    context.newPage.mockRejectedValueOnce(new Error('no page'));

    await expect(factory.createSession({ timeoutMs: 1000 })).rejects.toThrow(
      'no page',
    );
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('should launch the browser only once for concurrent sessions', async () => {
    await Promise.all([
      factory.createSession({ timeoutMs: 1000 }),
      factory.createSession({ timeoutMs: 1000 }),
    ]);

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(browser.newContext).toHaveBeenCalledTimes(2);
  });

  it('should try to launch again after a failed launch', async () => {
    vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('no chrome'));

    await expect(factory.createSession({ timeoutMs: 1000 })).rejects.toThrow(
      'no chrome',
    );
    await expect(
      factory.createSession({ timeoutMs: 1000 }),
    ).resolves.toBeInstanceOf(PlaywrightBrowserSession);
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });

  it('should close the browser on application shutdown', async () => {
    await factory.createSession({ timeoutMs: 1000 });
    await factory.onApplicationShutdown();

    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('should not launch a browser on shutdown if none was opened', async () => {
    await factory.onApplicationShutdown();

    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it('should refuse new sessions after shutdown instead of opening another browser', async () => {
    await factory.createSession({ timeoutMs: 1000 });
    await factory.onApplicationShutdown();

    await expect(factory.createSession({ timeoutMs: 1000 })).rejects.toThrow(
      'The browser is shut down',
    );
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('should close a browser that was still launching at shutdown', async () => {
    const creating = factory.createSession({ timeoutMs: 1000 });

    await factory.onApplicationShutdown();
    await creating.catch(() => undefined);

    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('should shut down quietly when the browser failed to launch', async () => {
    vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('no chrome'));
    const creating = factory.createSession({ timeoutMs: 1000 });

    await expect(factory.onApplicationShutdown()).resolves.toBeUndefined();
    await expect(creating).rejects.toThrow('no chrome');
  });
});
