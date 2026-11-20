import { describe, expect, it } from 'vitest';
import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import { selectQueries } from '../../src/bench/queries';
import { runBenchmark } from '../../src/bench/runner';
import type { SeedMarker } from '../../src/bench/seed';
import { resolveSeedShape } from '../../src/bench/shape';
import { createFakeClock } from '../fakeClock';

let shape = resolveSeedShape({ days: 10, eventDays: 5 });

let anchor = new Date('2026-11-18T12:00:00Z');

let marker = (): SeedMarker => ({
  _id: 'seed',
  createdAt: anchor,
  updatedAt: anchor,
  status: 'complete',
  seed: 1,
  anchor,
  shape,
  organizations: [
    {
      index: 0,
      ref: 'atbench-org-1-0',
      organizationId: 'ator_bench',
      projectId: 'atpr_bench',
      instanceIds: ['atin_0', 'atin_1'],
      userIds: ['aten_a'],
      anchor,
      nextDay: 10
    }
  ],
  written: { sessions: 150, slices: 400, events: 0 }
});

let rateLimited = () =>
  Object.assign(new Error('too many'), {
    data: { status: 429, code: 'too_many_requests', retry_after_seconds: 2 }
  });

let clientWith = (run: () => Promise<unknown>, calls: string[] = []) =>
  ({
    query: {
      run: async () => {
        calls.push('query.run');
        return run();
      },
      values: async () => {
        calls.push('query.values');
        return { values: [{ value: 'aten_a' }] };
      }
    },
    session: { list: async () => ({ items: [] }) }
  }) as unknown as AgentTrackingClient;

describe('benchmark runner', () => {
  it('measures warm samples and the service time', async () => {
    let report = await runBenchmark({
      client: clientWith(async () => ({
        totals: { requests: 7 },
        rows: [],
        meta: { elapsedMs: 3 }
      })),
      marker: marker(),
      queries: selectQueries(['spend.timeline']),
      repeats: 3,
      perMinute: 50,
      clock: createFakeClock(),
      log: () => {}
    });

    expect(report.queries[0]!.warmMs.count).toBe(3);
    expect(report.queries[0]!.serverWarmMs.p50).toBe(3);
  });

  it('counts a 429 as an invalid sample, never as a latency', async () => {
    let calls = 0;
    let clock = createFakeClock();
    let report = await runBenchmark({
      client: clientWith(async () => {
        if (++calls % 2 == 0) throw rateLimited();
        return { totals: { requests: 10 }, rows: [], meta: {} };
      }),
      marker: marker(),
      queries: selectQueries(['budget.usage.month.two_dimensions']),
      repeats: 4,
      perMinute: 50,
      clock,
      log: () => {}
    });
    let query = report.queries[0]!;

    expect(query.rateLimited).toBe(2);
    expect(query.coldMs.count + query.warmMs.count).toBe(3);
    expect(query.pass).toBe(false);
    expect(clock.now()).toBeGreaterThanOrEqual(4_000);
  });

  it('paces query.values like query.run', async () => {
    let calls: string[] = [];
    let clock = createFakeClock();

    await runBenchmark({
      client: clientWith(async () => ({ totals: { requests: 7 }, rows: [] }), calls),
      marker: marker(),
      queries: selectQueries(['filter.values.member']),
      repeats: 4,
      perMinute: 2,
      clock,
      log: () => {}
    });

    expect(calls).toEqual(Array(5).fill('query.values'));
    expect(clock.now()).toBeGreaterThanOrEqual(120_000);
  });
});
