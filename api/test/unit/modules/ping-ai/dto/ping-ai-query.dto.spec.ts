import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  PING_AI_MESSAGE_MAX_LENGTH,
  PingAiQueryDto,
} from '../../../../../src/modules/ping-ai/dto/ping-ai-query.dto.js';

describe('PingAiQueryDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  function validate(query: Record<string, unknown>): Promise<PingAiQueryDto> {
    return pipe.transform(query, {
      type: 'query',
      metatype: PingAiQueryDto,
    }) as Promise<PingAiQueryDto>;
  }

  it('should accept a missing message', async () => {
    await expect(validate({})).resolves.toEqual({});
  });

  it('should accept a message and trim it', async () => {
    await expect(validate({ message: '  Tudo bem?  ' })).resolves.toEqual({
      message: 'Tudo bem?',
    });
  });

  it('should keep line breaks inside the message', async () => {
    await expect(validate({ message: 'Oi!\nTudo bem?' })).resolves.toEqual({
      message: 'Oi!\nTudo bem?',
    });
  });

  it.each(['', '   ', '\n'])(
    'should reject the blank message %j',
    async (message) => {
      await expect(validate({ message })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('should reject a message longer than the limit', async () => {
    const message = 'a'.repeat(PING_AI_MESSAGE_MAX_LENGTH + 1);

    await expect(validate({ message })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should accept a message exactly at the limit', async () => {
    const message = 'a'.repeat(PING_AI_MESSAGE_MAX_LENGTH);

    await expect(validate({ message })).resolves.toEqual({ message });
  });

  it('should drop unknown query params', async () => {
    await expect(validate({ message: 'Oi', extra: 'x' })).resolves.toEqual({
      message: 'Oi',
    });
  });
});
