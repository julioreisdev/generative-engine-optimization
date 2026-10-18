import { Clock, systemClock } from './stopwatch.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
  clock?: Clock;
}

export class CircuitBreaker {
  private readonly clock: Clock;
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private trialInFlight = false;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.clock = options.clock ?? systemClock;
  }

  get state(): CircuitState {
    if (this.openedAt === null) {
      return 'closed';
    }
    return this.clock() - this.openedAt >= this.options.cooldownMs
      ? 'half-open'
      : 'open';
  }

  get failures(): number {
    return this.consecutiveFailures;
  }

  allowsTraffic(): boolean {
    return this.state === 'closed';
  }

  tryAcquire(): boolean {
    const state = this.state;
    if (state === 'closed') {
      return true;
    }
    if (state === 'half-open' && !this.trialInFlight) {
      this.trialInFlight = true;
      return true;
    }
    return false;
  }

  remainingCooldownMs(): number {
    if (this.openedAt === null) {
      return 0;
    }
    return Math.max(
      0,
      Math.round(this.options.cooldownMs - (this.clock() - this.openedAt)),
    );
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.trialInFlight = false;
  }

  recordFailure(): boolean {
    this.consecutiveFailures++;
    if (this.trialInFlight) {
      this.trialInFlight = false;
      this.openedAt = this.clock();
      return true;
    }
    if (
      this.openedAt === null &&
      this.consecutiveFailures >= this.options.failureThreshold
    ) {
      this.openedAt = this.clock();
      return true;
    }
    return false;
  }
}
