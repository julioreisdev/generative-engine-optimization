import { Injectable } from '@nestjs/common';

@Injectable()
export class PingService {
  ping(): string {
    return 'Pong GEO!';
  }
}
