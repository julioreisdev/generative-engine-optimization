import { appConfig } from '../../../src/config/app.config.js';
import { browserConfig } from '../../../src/config/browser.config.js';
import { pingAiConfig } from '../../../src/config/ping-ai.config.js';

const KEYS = [
  'PORT',
  'BROWSER_HEADLESS',
  'BROWSER_CHANNEL',
  'PING_AI_TIMEOUT_MS',
  'PING_AI_PAGE_READY_TIMEOUT_MS',
  'PING_AI_PREWARM',
  'PING_AI_PREWARM_REFRESH_MS',
  'PING_AI_RETRY_ATTEMPTS',
  'PING_AI_RETRY_BACKOFF_MS',
  'PING_AI_BREAKER_FAILURES',
  'PING_AI_BREAKER_COOLDOWN_MS',
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
    expect(pingAiConfig()).toEqual({
      timeoutMs: 90000,
      pageReadyTimeoutMs: 25000,
      prewarm: true,
      prewarmRefreshMs: 600000,
      retryAttempts: 3,
      retryBackoffMs: 1000,
      breakerFailures: 3,
      breakerCooldownMs: 300000,
    });
  });

  it('should read the values from env', () => {
    process.env.PORT = '4000';
    process.env.BROWSER_HEADLESS = 'false';
    process.env.BROWSER_CHANNEL = 'msedge';
    process.env.PING_AI_TIMEOUT_MS = '30000';
    process.env.PING_AI_PAGE_READY_TIMEOUT_MS = '15000';
    process.env.PING_AI_PREWARM = 'false';
    process.env.PING_AI_PREWARM_REFRESH_MS = '120000';
    process.env.PING_AI_RETRY_ATTEMPTS = '5';
    process.env.PING_AI_RETRY_BACKOFF_MS = '250';
    process.env.PING_AI_BREAKER_FAILURES = '2';
    process.env.PING_AI_BREAKER_COOLDOWN_MS = '60000';

    expect(appConfig()).toEqual({ port: 4000 });
    expect(browserConfig()).toEqual({ headless: false, channel: 'msedge' });
    expect(pingAiConfig()).toEqual({
      timeoutMs: 30000,
      pageReadyTimeoutMs: 15000,
      prewarm: false,
      prewarmRefreshMs: 120000,
      retryAttempts: 5,
      retryBackoffMs: 250,
      breakerFailures: 2,
      breakerCooldownMs: 60000,
    });
  });
});
