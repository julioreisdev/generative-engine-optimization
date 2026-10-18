import { ChatPrewarmer } from '../../../../../src/modules/ping-ai/prewarm/chat-prewarmer.js';
import { PrewarmedChatProvider } from '../../../../../src/modules/ping-ai/prewarm/prewarmed-chat.provider.js';
import {
  AiChatProvider,
  PreparableChatProvider,
} from '../../../../../src/modules/ping-ai/providers/ai-chat-provider.interface.js';

function prewarmed(name: string) {
  const inner: PreparableChatProvider = {
    name,
    prepare: vi.fn(),
    ask: vi.fn(),
  };
  const provider = new PrewarmedChatProvider(inner, { refreshMs: 600000 });
  vi.spyOn(provider, 'start').mockResolvedValue(undefined);
  vi.spyOn(provider, 'stop').mockResolvedValue(undefined);
  return provider;
}

describe('ChatPrewarmer', () => {
  const plain: AiChatProvider = { name: 'api', ask: vi.fn() };

  it('should start only the prewarmed providers when the app boots', async () => {
    const chatgpt = prewarmed('chatgpt');
    const gemini = prewarmed('gemini');
    const prewarmer = new ChatPrewarmer([chatgpt, plain, gemini]);

    prewarmer.onApplicationBootstrap();
    await prewarmer.ready();

    expect(chatgpt.start).toHaveBeenCalledTimes(1);
    expect(gemini.start).toHaveBeenCalledTimes(1);
  });

  it('should be ready right away when nothing is prewarmed', async () => {
    const prewarmer = new ChatPrewarmer([plain]);

    prewarmer.onApplicationBootstrap();

    await expect(prewarmer.ready()).resolves.toBeUndefined();
  });

  it('should stop the prewarmed providers when the module is destroyed', async () => {
    const chatgpt = prewarmed('chatgpt');
    const prewarmer = new ChatPrewarmer([chatgpt, plain]);

    await prewarmer.onModuleDestroy();

    expect(chatgpt.stop).toHaveBeenCalledTimes(1);
  });
});
