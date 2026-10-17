import { Stopwatch } from '../../../src/common/stopwatch.js';

describe('Stopwatch', () => {
  it('should measure the time since it was created', () => {
    let now = 1000;
    const stopwatch = new Stopwatch(() => now);

    now = 1250;

    expect(stopwatch.elapsedMs()).toBe(250);
  });

  it('should round to whole milliseconds', () => {
    let now = 0;
    const stopwatch = new Stopwatch(() => now);

    now = 10.6;

    expect(stopwatch.elapsedMs()).toBe(11);
  });

  it('should use the real clock by default', () => {
    expect(new Stopwatch().elapsedMs()).toBeGreaterThanOrEqual(0);
  });
});
