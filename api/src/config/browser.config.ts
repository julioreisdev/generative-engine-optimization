import { registerAs } from '@nestjs/config';
import { parseBoolean } from './env.js';

export const browserConfig = registerAs('browser', () => ({
  headless: parseBoolean(process.env.BROWSER_HEADLESS, true),
  channel: process.env.BROWSER_CHANNEL || 'chrome',
}));
