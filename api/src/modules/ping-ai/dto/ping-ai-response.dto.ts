import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PingAiStatus = 'success' | 'timeout' | 'error';

export class PingAiMetricsDto {
  @ApiProperty({ type: Number, nullable: true, example: 3100 })
  pageLoadMs: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 1800 })
  timeToFirstTokenMs: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 4200 })
  responseTimeMs: number | null;

  @ApiProperty({ example: 7300 })
  totalTimeMs: number;

  @ApiProperty({ example: 22 })
  responseLength: number;
}

export class PingAiResultDto {
  @ApiProperty({ example: 'chatgpt' })
  provider: string;

  @ApiProperty({ enum: ['success', 'timeout', 'error'], example: 'success' })
  status: PingAiStatus;

  @ApiProperty({
    example: true,
    description: 'true when the chat page was already open and ready',
  })
  warm: boolean;

  @ApiPropertyOptional({ example: 'Oi! Como posso ajudar?' })
  response?: string;

  @ApiPropertyOptional({ example: 'Timeout after 90000ms' })
  error?: string;

  @ApiProperty({ type: PingAiMetricsDto })
  metrics: PingAiMetricsDto;
}

export class PingAiResponseDto {
  @ApiProperty({ example: 'Oi!' })
  message: string;

  @ApiProperty({ example: '2026-10-17T18:00:00.000Z' })
  startedAt: string;

  @ApiProperty({ example: 14230 })
  totalTimeMs: number;

  @ApiProperty({ type: [PingAiResultDto] })
  results: PingAiResultDto[];
}
