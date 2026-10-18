export interface Closable {
  close(): Promise<void>;
}

export function closeOnAbort(
  signal: AbortSignal | undefined,
  target: Closable,
): () => void {
  if (!signal) {
    return () => undefined;
  }
  const close = () => void target.close();
  signal.addEventListener('abort', close, { once: true });
  return () => signal.removeEventListener('abort', close);
}
