import { Clock, Stopwatch, systemClock } from '../../../common/stopwatch.js';
import { PingAiMetricsDto } from '../dto/ping-ai-response.dto.js';
import { AskProgress } from '../providers/ai-chat-provider.interface.js';

export class MetricsRecorder implements AskProgress {
  private readonly total: Stopwatch;
  private sinceSent: Stopwatch;
  private pageLoadMs: number | null = null;
  private timeToFirstTokenMs: number | null = null;
  private responseTimeMs: number | null = null;
  private responseLength = 0;
  private warmPage = false;

  constructor(private readonly clock: Clock = systemClock) {
    this.total = new Stopwatch(clock);
    this.sinceSent = this.total;
  }

  get warm(): boolean {
    return this.warmPage;
  }

  pageReady(warm: boolean): void {
    this.warmPage = warm;
    this.pageLoadMs = this.total.elapsedMs();
  }

  messageSent(): void {
    this.sinceSent = new Stopwatch(this.clock);
  }

  firstToken(): void {
    this.timeToFirstTokenMs = this.sinceSent.elapsedMs();
  }

  responseReceived(response: string): void {
    this.responseTimeMs = this.sinceSent.elapsedMs();
    this.responseLength = response.length;
  }

  finish(): PingAiMetricsDto {
    return {
      pageLoadMs: this.pageLoadMs,
      timeToFirstTokenMs: this.timeToFirstTokenMs,
      responseTimeMs: this.responseTimeMs,
      totalTimeMs: this.total.elapsedMs(),
      responseLength: this.responseLength,
    };
  }
}
