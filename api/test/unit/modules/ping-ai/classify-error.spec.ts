import { OperationTimeoutError } from '../../../../src/common/with-timeout.js';
import { classifyError } from '../../../../src/modules/ping-ai/classify-error.js';

describe('classifyError', () => {
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
