import { describe, expect, it } from 'vitest';
import { summarize } from '../../src/lib/stats';
import { defaultKneeThresholds, findKnee } from '../../src/load/knee';
import type { LaneStepResult, StepResult } from '../../src/load/run';

let lane = (d: {
  achieved: number;
  p95: number;
  busyRate?: number;
  errorRate?: number;
  serviceP95?: number;
  clientWaitP95?: number;
}): LaneStepResult => ({
  offeredRecordsPerSecond: d.achieved,
  achievedRecordsPerSecond: d.achieved,
  attempts: 100,
  statusCounts: { '200': 100 },
  latencyMs: {
    ...summarize([1]),
    p95: d.serviceP95 ?? d.p95,
    p99: (d.serviceP95 ?? d.p95) * 1.2
  },
  latencyFromScheduleMs: { ...summarize([d.p95 / 2]), p95: d.p95, p99: d.p95 * 1.2 },
  clientWaitMs: { ...summarize([0]), p95: d.clientWaitP95 ?? 0 },
  deliveryLatencyMs: summarize([d.p95]),
  busyResponses: 0,
  busyRate: d.busyRate ?? 0,
  retriedDeliveries: 0,
  failedDeliveries: 0,
  errorRate: d.errorRate ?? 0,
  rejectedRecords: 0,
  scheduleLagMs: summarize([0])
});

let step = (index: number, target: number, live: LaneStepResult): StepResult => ({
  step: index,
  targetRecordsPerSecond: target,
  backfillRecordsPerSecond: null,
  windowMs: 50_000,
  live,
  backfill: null
});

describe('knee', () => {
  it('is the last passing step before the first failure', () => {
    let knee = findKnee(
      [
        step(0, 500, lane({ achieved: 500, p95: 80 })),
        step(1, 1000, lane({ achieved: 990, p95: 120 })),
        step(2, 2000, lane({ achieved: 1990, p95: 700 })),
        step(3, 4000, lane({ achieved: 2600, p95: 1900, busyRate: 0.2 }))
      ],
      'live'
    );

    expect(knee.knee).toEqual({
      step: 2,
      targetRecordsPerSecond: 2000,
      achievedRecordsPerSecond: 1990
    });
    expect(knee.firstFailure?.step).toBe(3);
    expect(knee.firstFailure?.reasons.join(' ')).toMatch(/p95 1900 ms/);
    expect(knee.firstFailure?.reasons.join(' ')).toMatch(/busy rate 20.00%/);
    expect(knee.firstFailure?.reasons.join(' ')).toMatch(/achieved 2600/);
  });

  it('does not move past a failure when a later step passes again', () => {
    let knee = findKnee(
      [
        step(0, 500, lane({ achieved: 500, p95: 80 })),
        step(1, 1000, lane({ achieved: 1000, p95: 80, errorRate: 0.01 })),
        step(2, 2000, lane({ achieved: 2000, p95: 80 }))
      ],
      'live'
    );

    expect(knee.knee?.step).toBe(0);
    expect(knee.passedAfterFailure).toEqual([2]);
  });

  it('has no knee when the first step fails, and judges steps by rate not order', () => {
    let knee = findKnee(
      [
        step(1, 1000, lane({ achieved: 1000, p95: 5000 })),
        step(0, 500, lane({ achieved: 300, p95: 80 }))
      ],
      'live',
      { ...defaultKneeThresholds, minAchievedRatio: 0.9 }
    );

    expect(knee.knee).toBeNull();
    expect(knee.verdicts.map(verdict => verdict.step)).toEqual([0, 1]);
  });

  it('fails steps without measurements', () => {
    let knee = findKnee(
      [{ ...step(0, 100, lane({ achieved: 0, p95: 0 })), live: null }],
      'live'
    );

    expect(knee.knee).toBeNull();
    expect(knee.firstFailure?.reasons).toEqual(['no requests were measured']);
  });

  it('judges latency from the scheduled send time, not from when a slot freed up', () => {
    let knee = findKnee(
      [step(0, 500, lane({ achieved: 500, p95: 1_800, serviceP95: 90 }))],
      'live'
    );

    expect(knee.knee).toBeNull();
    expect(knee.firstFailure?.reasons.join(' ')).toMatch(/p95 1800 ms/);
  });

  it('calls a step client-limited when the generator queue is the bottleneck', () => {
    let knee = findKnee(
      [
        step(0, 500, lane({ achieved: 500, p95: 80 })),
        step(1, 1000, lane({ achieved: 700, p95: 900, clientWaitP95: 600 }))
      ],
      'live'
    );

    expect(knee.knee?.step).toBe(0);
    expect(knee.firstFailure?.limitedBy).toBe('client');
    expect(knee.firstFailure?.reasons[0]).toMatch(/client-limited, not a service limit/);
    expect(knee.verdicts[0]!.limitedBy).toBeNull();
  });

  it('calls a step service-limited when the generator kept up', () => {
    let knee = findKnee([step(0, 500, lane({ achieved: 300, p95: 80 }))], 'live');

    expect(knee.firstFailure?.limitedBy).toBe('service');
  });
});
