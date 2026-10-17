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
    recorder.pageReady();
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

  it('should keep the unreached steps as null', () => {
    now = 3000;
    recorder.pageReady();
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
