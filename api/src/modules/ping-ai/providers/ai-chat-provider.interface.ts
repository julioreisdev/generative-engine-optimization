export const AI_CHAT_PROVIDERS = Symbol('AI_CHAT_PROVIDERS');

export interface AskProgress {
  pageReady(): void;
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
