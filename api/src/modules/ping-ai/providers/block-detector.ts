import { PageSnapshot } from '../../browser/browser-session.interface.js';
import { BlockReason } from '../errors/chat-errors.js';

export interface BlockDetector {
  reason: BlockReason;
  url?: RegExp;
  title?: RegExp;
  text?: RegExp;
}

export function findBlock(
  snapshot: PageSnapshot,
  detectors: BlockDetector[],
): BlockReason | null {
  const detector = detectors.find(
    (candidate) =>
      candidate.url?.test(snapshot.url) ||
      candidate.title?.test(snapshot.title) ||
      candidate.text?.test(snapshot.text),
  );
  return detector?.reason ?? null;
}
