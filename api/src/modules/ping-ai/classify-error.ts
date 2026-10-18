import { OperationTimeoutError } from '../../common/with-timeout.js';
import { PingAiStatus } from './dto/ping-ai-response.dto.js';
import {
  BlockReason,
  ChatBlockedError,
  ChatUnavailableError,
} from './errors/chat-errors.js';

export interface ClassifiedError {
  status: Exclude<PingAiStatus, 'success'>;
  message: string;
  blockReason?: BlockReason;
}

export function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ChatBlockedError) {
    return { status: 'blocked', message, blockReason: error.reason };
  }
  if (error instanceof ChatUnavailableError) {
    return { status: 'unavailable', message };
  }
  if (error instanceof OperationTimeoutError) {
    return { status: 'timeout', message };
  }
  return { status: 'error', message };
}
