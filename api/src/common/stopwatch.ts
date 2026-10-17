export type Clock = () => number;

export const systemClock: Clock = () => performance.now();

export class Stopwatch {
  private readonly startedAt: number;

  constructor(private readonly clock: Clock = systemClock) {
    this.startedAt = clock();
  }

  elapsedMs(): number {
    return Math.round(this.clock() - this.startedAt);
  }
}
