import { MetricsRecorder } from '../../../../../src/modules/ping-ai/metrics/metrics-recorder.js';

describe('MetricsRecorder', () => {
  let now: number;
  let recorder: MetricsRecorder;

  beforeEach(() => {
    now = 0;
    recorder = new MetricsRecorder(() => now);
  });

  it('should measure every step of a successful answer', () => {
    now = 3000;
    recorder.pageReady(false);
    now = 3500;
    recorder.messageSent();
    now = 5500;
    recorder.firstToken();
    now = 7500;
    recorder.responseReceived('Olá!');
    now = 8000;

    expect(recorder.finish()).toEqual({
      pageLoadMs: 3000,
      timeToFirstTokenMs: 2000,
      responseTimeMs: 4000,
      totalTimeMs: 8000,
      responseLength: 4,
    });
  });

  it('should tell whether the page was already warm', () => {
    expect(recorder.warm).toBe(false);

    recorder.pageReady(true);

    expect(recorder.warm).toBe(true);
    expect(recorder.finish().pageLoadMs).toBe(0);
  });

  it('should count one attempt when no attempt was reported', () => {
    expect(recorder.attempts).toBe(1);
  });

  it('should measure the page load of the last attempt only', () => {
    recorder.attemptStarted();
    now = 2000;
    recorder.pageReady(true);
    now = 5000;
    recorder.attemptStarted();
    now = 9000;
    recorder.pageReady(false);
    recorder.messageSent();
    now = 10000;
    recorder.firstToken();
    now = 11000;
    recorder.responseReceived('Olá!');

    expect(recorder.attempts).toBe(2);
    expect(recorder.warm).toBe(false);
    expect(recorder.finish()).toEqual({
      pageLoadMs: 4000,
      timeToFirstTokenMs: 1000,
      responseTimeMs: 2000,
      totalTimeMs: 11000,
      responseLength: 4,
    });
  });

  it('should clear the steps of a failed attempt', () => {
    recorder.attemptStarted();
    now = 1000;
    recorder.pageReady(true);
    recorder.messageSent();
    recorder.firstToken();
    recorder.attemptStarted();

    expect(recorder.warm).toBe(false);
    expect(recorder.finish()).toMatchObject({
      pageLoadMs: null,
      timeToFirstTokenMs: null,
      responseTimeMs: null,
    });
  });

  it('should keep the unreached steps as null', () => {
    now = 3000;
    recorder.pageReady(false);
    now = 9000;

    expect(recorder.finish()).toEqual({
      pageLoadMs: 3000,
      timeToFirstTokenMs: null,
      responseTimeMs: null,
      totalTimeMs: 9000,
      responseLength: 0,
    });
  });
});
