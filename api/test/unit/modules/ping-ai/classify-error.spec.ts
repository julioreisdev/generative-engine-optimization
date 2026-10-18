import { OperationTimeoutError } from '../../../../src/common/with-timeout.js';
import { classifyError } from '../../../../src/modules/ping-ai/classify-error.js';
import {
  ChatBlockedError,
  ChatNotReadyError,
  ChatUnavailableError,
} from '../../../../src/modules/ping-ai/errors/chat-errors.js';

describe('classifyError', () => {
  it('should classify ChatBlockedError as blocked, with the reason', () => {
    expect(classifyError(new ChatBlockedError('chatgpt', 'captcha'))).toEqual({
      status: 'blocked',
      message: 'chatgpt blocked the access (captcha)',
      blockReason: 'captcha',
    });
  });

  it('should classify ChatUnavailableError as unavailable', () => {
    expect(classifyError(new ChatUnavailableError('gemini', 120000))).toEqual({
      status: 'unavailable',
      message: 'gemini is paused after consecutive failures. Next try in 120s',
    });
  });

  it('should classify ChatNotReadyError as error', () => {
    expect(classifyError(new ChatNotReadyError('gemini', 25000)).status).toBe(
      'error',
    );
  });

  it('should classify OperationTimeoutError as timeout', () => {
    expect(
      classifyError(new OperationTimeoutError('Timeout after 100ms')),
    ).toEqual({ status: 'timeout', message: 'Timeout after 100ms' });
  });

  it('should classify any other Error as error', () => {
    expect(classifyError(new Error('blocked'))).toEqual({
      status: 'error',
      message: 'blocked',
    });
  });

  it('should accept values that are not errors', () => {
    expect(classifyError('offline')).toEqual({
      status: 'error',
      message: 'offline',
    });
  });
});
