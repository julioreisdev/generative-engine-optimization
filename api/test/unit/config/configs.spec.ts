import { appConfig } from '../../../src/config/app.config.js';
import { browserConfig } from '../../../src/config/browser.config.js';
import { pingAiConfig } from '../../../src/config/ping-ai.config.js';

const KEYS = [
  'PORT',
  'BROWSER_HEADLESS',
  'BROWSER_CHANNEL',
  'PING_AI_TIMEOUT_MS',
];

describe('configs', () => {
  const original = { ...process.env };

  beforeEach(() => {
    for (const key of KEYS) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = original;
  });

  it('should use the defaults when no env is set', () => {
    expect(appConfig()).toEqual({ port: 3000 });
    expect(browserConfig()).toEqual({ headless: true, channel: 'chrome' });
    expect(pingAiConfig()).toEqual({ timeoutMs: 90000 });
  });

  it('should read the values from env', () => {
    process.env.PORT = '4000';
    process.env.BROWSER_HEADLESS = 'false';
    process.env.BROWSER_CHANNEL = 'msedge';
    process.env.PING_AI_TIMEOUT_MS = '30000';

    expect(appConfig()).toEqual({ port: 4000 });
    expect(browserConfig()).toEqual({ headless: false, channel: 'msedge' });
    expect(pingAiConfig()).toEqual({ timeoutMs: 30000 });
  });
});
