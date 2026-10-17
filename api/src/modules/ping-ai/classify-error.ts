import { OperationTimeoutError } from '../../common/with-timeout.js';
import { PingAiStatus } from './dto/ping-ai-response.dto.js';

export interface ClassifiedError {
  status: Exclude<PingAiStatus, 'success'>;
  message: string;
}

export function classifyError(error: unknown): ClassifiedError {
  return {
    status: error instanceof OperationTimeoutError ? 'timeout' : 'error',
    message: error instanceof Error ? error.message : String(error),
  };
}
