import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PingAiQueryDto } from './dto/ping-ai-query.dto.js';
import { PingAiResponseDto } from './dto/ping-ai-response.dto.js';
import { PingAiService } from './ping-ai.service.js';

@ApiTags('ping-ai')
@Controller('ping-ai')
export class PingAiController {
  constructor(private readonly pingAiService: PingAiService) {}

  @Get()
  @ApiOperation({
    summary: 'Sends a message to ChatGPT and Gemini and returns the answers',
  })
  @ApiOkResponse({ type: PingAiResponseDto })
  @ApiBadRequestResponse({ description: 'Blank or too long message' })
  ping(@Query() query: PingAiQueryDto): Promise<PingAiResponseDto> {
    return this.pingAiService.run(query.message);
  }
}
