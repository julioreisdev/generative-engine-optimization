import { OperationTimeoutError } from '../../../../../src/common/with-timeout.js';
import {
  ChatBlockedError,
  ChatNotReadyError,
  ChatUnavailableError,
  isRetryable,
} from '../../../../../src/modules/ping-ai/errors/chat-errors.js';

describe('chat errors', () => {
  it('should describe a blocked access', () => {
    const error = new ChatBlockedError('chatgpt', 'captcha');

    expect(error.message).toBe('chatgpt blocked the access (captcha)');
    expect(error.provider).toBe('chatgpt');
    expect(error.reason).toBe('captcha');
  });

  it('should describe a chat that was not ready', () => {
    expect(new ChatNotReadyError('gemini', 25000).message).toContain(
      'gemini: the message input did not appear within 25000ms',
    );
  });

  it('should not retry a blocked access', () => {
    expect(isRetryable(new ChatBlockedError('chatgpt', 'login'))).toBe(false);
  });

  it('should not retry a paused provider', () => {
    expect(isRetryable(new ChatUnavailableError('chatgpt', 1000))).toBe(false);
  });

  it('should round the remaining pause up to whole seconds', () => {
    expect(new ChatUnavailableError('chatgpt', 1500).message).toContain(
      'Next try in 2s',
    );
  });

  it.each([
    new ChatNotReadyError('gemini', 25000),
    new OperationTimeoutError('Timeout 30000ms exceeded.'),
    new Error('net::ERR_CONNECTION_RESET'),
  ])('should retry passing failures (%s)', (error) => {
    expect(isRetryable(error)).toBe(true);
  });
});
