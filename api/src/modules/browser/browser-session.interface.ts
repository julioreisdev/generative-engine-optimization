export const BROWSER_SESSION_FACTORY = Symbol('BROWSER_SESSION_FACTORY');

export interface BrowserSessionOptions {
  timeoutMs: number;
}

export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
}

export interface BrowserSession {
  open(url: string): Promise<void>;
  waitForVisible(selector: string, timeoutMs?: number): Promise<void>;
  click(selector: string): Promise<void>;
  type(text: string): Promise<void>;
  waitForText(selector: string): Promise<void>;
  lastText(selector: string): Promise<string>;
  exists(selector: string): Promise<boolean>;
  inspect(): Promise<PageSnapshot>;
  pause(ms: number): Promise<void>;
  close(): Promise<void>;
}

export interface BrowserSessionFactory {
  createSession(options: BrowserSessionOptions): Promise<BrowserSession>;
}
