import { chromium } from 'playwright';
import { BrowserService } from '../../../../src/modules/browser/browser.service.js';

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn() },
}));

describe('BrowserService', () => {
  const context = {};
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
  let service: BrowserService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chromium.launch).mockResolvedValue(browser as never);
    service = new BrowserService();
  });

  it('should create a context with pt-BR locale and a non-headless user agent', async () => {
    const result = await service.newContext();

    expect(result).toBe(context);
    expect(browser.newContext).toHaveBeenCalledWith({
      locale: 'pt-BR',
      userAgent: 'Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36',
    });
  });

  it('should launch the browser only once for concurrent contexts', async () => {
    await Promise.all([service.newContext(), service.newContext()]);

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(browser.newContext).toHaveBeenCalledTimes(2);
  });

  it('should try to launch again after a failed launch', async () => {
    vi.mocked(chromium.launch).mockRejectedValueOnce(new Error('no chrome'));

    await expect(service.newContext()).rejects.toThrow('no chrome');
    await expect(service.newContext()).resolves.toBe(context);
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });

  it('should close the browser on module destroy', async () => {
    await service.newContext();
    await service.onModuleDestroy();

    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('should not launch a browser on module destroy if none was opened', async () => {
    await service.onModuleDestroy();

    expect(chromium.launch).not.toHaveBeenCalled();
  });
});
