import { NestFactory } from '@nestjs/core';
import { ConfigType } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { appConfig } from './config/app.config.js';
import { setupSwagger } from './config/swagger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  setupSwagger(app);
  const { port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(port);
}
await bootstrap();
