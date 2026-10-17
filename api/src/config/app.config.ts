import { registerAs } from '@nestjs/config';
import { parsePositiveInt } from './env.js';

export const appConfig = registerAs('app', () => ({
  port: parsePositiveInt(process.env.PORT, 3000),
}));
