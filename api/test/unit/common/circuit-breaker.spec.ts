import { CircuitBreaker } from '../../../src/common/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let now: number;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    now = 0;
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 60000,
      clock: () => now,
    });
  });

  function failTimes(times: number): boolean[] {
    return Array.from({ length: times }, () => {
      breaker.tryAcquire();
      return breaker.recordFailure();
    });
  }

  it('should start closed and let requests through', () => {
    expect(breaker.state).toBe('closed');
    expect(breaker.tryAcquire()).toBe(true);
    expect(breaker.allowsTraffic()).toBe(true);
  });

  it('should open after the configured consecutive failures', () => {
    expect(failTimes(3)).toEqual([false, false, true]);

    expect(breaker.state).toBe('open');
    expect(breaker.tryAcquire()).toBe(false);
    expect(breaker.allowsTraffic()).toBe(false);
  });

  it('should reset the count after a success', () => {
    failTimes(2);
    breaker.recordSuccess();
    failTimes(2);

    expect(breaker.state).toBe('closed');
  });

  it('should tell how long the pause still lasts', () => {
    failTimes(3);
    now = 45000;

    expect(breaker.remainingCooldownMs()).toBe(15000);
  });

  it('should allow a single trial request after the cooldown', () => {
    failTimes(3);
    now = 60000;

    expect(breaker.state).toBe('half-open');
    expect(breaker.allowsTraffic()).toBe(false);
    expect(breaker.tryAcquire()).toBe(true);
    expect(breaker.tryAcquire()).toBe(false);
  });

  it('should close again when the trial succeeds', () => {
    failTimes(3);
    now = 60000;
    breaker.tryAcquire();

    breaker.recordSuccess();

    expect(breaker.state).toBe('closed');
    expect(breaker.failures).toBe(0);
  });

  it('should pause again for a full cooldown when the trial fails', () => {
    failTimes(3);
    now = 60000;
    breaker.tryAcquire();

    expect(breaker.recordFailure()).toBe(true);

    expect(breaker.state).toBe('open');
    expect(breaker.remainingCooldownMs()).toBe(60000);
  });

  it('should not extend the pause because of late failures from older requests', () => {
    failTimes(3);
    now = 30000;

    expect(breaker.recordFailure()).toBe(false);

    expect(breaker.remainingCooldownMs()).toBe(30000);
  });
});
