import { BrowserContext, errors, Page } from 'playwright';
import { OperationTimeoutError } from '../../../../../src/common/with-timeout.js';
import { PlaywrightBrowserSession } from '../../../../../src/modules/browser/playwright/playwright-browser-session.js';

describe('PlaywrightBrowserSession', () => {
  const locator = {
    first: vi.fn(),
    last: vi.fn(),
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue('Olá!'),
    count: vi.fn().mockResolvedValue(0),
  };
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn().mockReturnValue(locator),
    keyboard: { insertText: vi.fn().mockResolvedValue(undefined) },
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  };
  const context = { close: vi.fn().mockResolvedValue(undefined) };
  let session: PlaywrightBrowserSession;

  beforeEach(() => {
    vi.clearAllMocks();
    locator.first.mockReturnValue(locator);
    locator.last.mockReturnValue(locator);
    session = new PlaywrightBrowserSession(
      context as unknown as BrowserContext,
      page as unknown as Page,
    );
  });

  it('should open the url waiting for the DOM', async () => {
    await session.open('https://chat.test/');

    expect(page.goto).toHaveBeenCalledWith('https://chat.test/', {
      waitUntil: 'domcontentloaded',
    });
  });

  it('should wait for and click the first matching element', async () => {
    await session.waitForVisible('#input');
    await session.click('#send');

    expect(page.locator).toHaveBeenCalledWith('#input');
    expect(page.locator).toHaveBeenCalledWith('#send');
    expect(locator.waitFor).toHaveBeenCalledTimes(1);
    expect(locator.click).toHaveBeenCalledTimes(1);
  });

  it('should insert the whole text at once, keeping line breaks', async () => {
    await session.type('Oi!\nTudo bem?');

    expect(page.keyboard.insertText).toHaveBeenCalledWith('Oi!\nTudo bem?');
  });

  it('should wait for text in the given selector', async () => {
    await session.waitForText('.answer');

    expect(page.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      '.answer',
    );
  });

  it('should read the text of the last matching element', async () => {
    await expect(session.lastText('.answer')).resolves.toBe('Olá!');
    expect(locator.last).toHaveBeenCalledTimes(1);
  });

  it('should tell whether an element exists', async () => {
    locator.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    await expect(session.exists('.busy')).resolves.toBe(true);
    await expect(session.exists('.busy')).resolves.toBe(false);
  });

  it('should pause for the given time', async () => {
    await session.pause(250);

    expect(page.waitForTimeout).toHaveBeenCalledWith(250);
  });

  it('should convert Playwright timeouts into OperationTimeoutError', async () => {
    locator.waitFor.mockRejectedValueOnce(
      new errors.TimeoutError('Timeout 100ms exceeded.'),
    );

    const result = session.waitForVisible('#input');

    await expect(result).rejects.toBeInstanceOf(OperationTimeoutError);
    await expect(result).rejects.toThrow('Timeout 100ms exceeded.');
  });

  it('should keep other errors as they are', async () => {
    page.goto.mockRejectedValueOnce(new Error('net::ERR_NAME_NOT_RESOLVED'));

    const result = session.open('https://chat.test/');

    await expect(result).rejects.not.toBeInstanceOf(OperationTimeoutError);
    await expect(result).rejects.toThrow('net::ERR_NAME_NOT_RESOLVED');
  });

  it('should close the context and ignore errors when closing', async () => {
    context.close.mockRejectedValueOnce(new Error('already closed'));

    await expect(session.close()).resolves.toBeUndefined();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
