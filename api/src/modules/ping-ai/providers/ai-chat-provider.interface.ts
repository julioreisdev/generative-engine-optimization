export const AI_CHAT_PROVIDERS = Symbol('AI_CHAT_PROVIDERS');

export interface AskProgress {
  attemptStarted(): void;
  pageReady(warm: boolean): void;
  messageSent(): void;
  firstToken(): void;
}

export interface AskOptions {
  signal: AbortSignal;
  progress: AskProgress;
}

export interface AiChatProvider {
  readonly name: string;
  ask(message: string, options: AskOptions): Promise<string>;
}

export interface PreparedChat {
  send(message: string, options: AskOptions): Promise<string>;
  close(): Promise<void>;
}

export interface PrepareOptions {
  signal?: AbortSignal;
  onAttempt?: () => void;
}

export interface PreparableChatProvider extends AiChatProvider {
  prepare(options?: PrepareOptions): Promise<PreparedChat>;
}
