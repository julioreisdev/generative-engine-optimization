import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  AI_CHAT_PROVIDERS,
  type AiChatProvider,
} from '../providers/ai-chat-provider.interface.js';
import { PrewarmedChatProvider } from './prewarmed-chat.provider.js';

@Injectable()
export class ChatPrewarmer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly prewarmed: PrewarmedChatProvider[];
  private started: Promise<void> = Promise.resolve();

  constructor(@Inject(AI_CHAT_PROVIDERS) providers: AiChatProvider[]) {
    this.prewarmed = providers.filter(
      (provider) => provider instanceof PrewarmedChatProvider,
    );
  }

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
