import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrewarmedChatProvider } from './prewarmed-chat.provider.js';

export const PREWARMED_CHAT_PROVIDERS = Symbol('PREWARMED_CHAT_PROVIDERS');

@Injectable()
export class ChatPrewarmer implements OnApplicationBootstrap, OnModuleDestroy {
  private started: Promise<void> = Promise.resolve();

  constructor(
    @Inject(PREWARMED_CHAT_PROVIDERS)
    private readonly prewarmed: PrewarmedChatProvider[],
  ) {}

  onApplicationBootstrap(): void {
    this.started = Promise.all(
      this.prewarmed.map((provider) => provider.start()),
    ).then(() => undefined);
  }

  ready(): Promise<void> {
    return this.started;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.prewarmed.map((provider) => provider.stop()));
  }
}
