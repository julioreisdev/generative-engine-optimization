import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PingAiResponseDto } from './dto/ping-ai-response.dto.js';
import { PingAiService } from './ping-ai.service.js';

@ApiTags('ping-ai')
@Controller('ping-ai')
export class PingAiController {
  constructor(private readonly pingAiService: PingAiService) {}

  @Get()
  @ApiOperation({
    summary: 'Sends "Oi!" to ChatGPT and Gemini and returns the answers',
  })
  @ApiOkResponse({ type: PingAiResponseDto })
  ping(): Promise<PingAiResponseDto> {
    return this.pingAiService.run();
  }
}
