import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const PING_AI_MESSAGE_MAX_LENGTH = 2000;

export class PingAiQueryDto {
  @ApiPropertyOptional({
    description: 'Message sent to every AI chat. Defaults to "Oi!"',
    example: 'Quais as melhores pizzarias em São Paulo?',
    maxLength: PING_AI_MESSAGE_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(PING_AI_MESSAGE_MAX_LENGTH)
  message?: string;
}
