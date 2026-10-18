import { Clock, Stopwatch, systemClock } from '../../../common/stopwatch.js';
import { PingAiMetricsDto } from '../dto/ping-ai-response.dto.js';
import { AskProgress } from '../providers/ai-chat-provider.interface.js';

export class MetricsRecorder implements AskProgress {
  private readonly total: Stopwatch;
  private sinceAttempt: Stopwatch;
  private sinceSent: Stopwatch;
  private attemptCount = 0;
  private warmPage = false;
  private pageLoadMs: number | null = null;
  private timeToFirstTokenMs: number | null = null;
  private responseTimeMs: number | null = null;
  private responseLength = 0;

  constructor(private readonly clock: Clock = systemClock) {
    this.total = new Stopwatch(clock);
    this.sinceAttempt = this.total;
    this.sinceSent = this.total;
  }

  get warm(): boolean {
    return this.warmPage;
  }

  get attempts(): number {
    return Math.max(this.attemptCount, 1);
  }

  attemptStarted(): void {
    this.attemptCount++;
    this.sinceAttempt = new Stopwatch(this.clock);
    this.sinceSent = this.sinceAttempt;
    this.warmPage = false;
    this.pageLoadMs = null;
    this.timeToFirstTokenMs = null;
    this.responseTimeMs = null;
  }

  pageReady(warm: boolean): void {
    this.warmPage = warm;
    this.pageLoadMs = this.sinceAttempt.elapsedMs();
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
