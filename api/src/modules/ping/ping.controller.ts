import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PingService } from './ping.service.js';

@ApiTags('ping')
@Controller('ping')
export class PingController {
  constructor(private readonly pingService: PingService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ type: String, example: 'Pong GEO!' })
  ping(): string {
    return this.pingService.ping();
  }
}
