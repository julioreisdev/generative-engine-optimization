import {
  AskOptions,
  PreparableChatProvider,
} from './ai-chat-provider.interface.js';

export async function askThroughPrepare(
  provider: PreparableChatProvider,
  message: string,
  options: AskOptions,
): Promise<string> {
  const chat = await provider.prepare({
    signal: options.signal,
    onAttempt: () => options.progress.attemptStarted(),
  });
  try {
    options.progress.pageReady(false);
    return await chat.send(message, options);
  } finally {
    await chat.close();
  }
}
