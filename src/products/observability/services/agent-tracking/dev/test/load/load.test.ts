import { describe, expect, it } from 'vitest';
import { realClock } from '../../src/lib/clock';
import { createInProcessIngest } from '../../src/load/dryRun';
import { findKnee } from '../../src/load/knee';
import { defaultTrafficProfile } from '../../src/load/profile';
import {
  laneStepResult,
  runLoad,
  type Attempt,
  type Delivery,
  type HttpSend,
  type LoadConfig
} from '../../src/load/run';
import { createBatchStream } from '../../src/load/synth';

let config = (overrides: Partial<LoadConfig> = {}): LoadConfig => ({
  url: 'http://ingest.test',
  key: 'metorial_agis_test',
  rates: [400],
  backfillRates: null,
  liveEnabled: true,
  stepMs: 400,
  warmupMs: 0,
  concurrency: 8,
  maxOutstanding: 500,
  maxRetries: 3,
  maxRetryWaitMs: 50,
  requestTimeoutMs: 1_000,
  drainTimeoutMs: 2_000,
  format: 'protobuf',
  compression: 'none',
  profile: defaultTrafficProfile,
  seed: 1,
  ...overrides
});

let stream = () =>
  createBatchStream({
    profile: defaultTrafficProfile,
    seed: 1,
    developers: 10,
    clock: realClock.now
  });

let ok = (body = new Uint8Array()) => ({
  status: 200,
  headers: new Headers({ 'content-type': 'application/x-protobuf' }),
  body
});

let busy = () => ({
  status: 503,
  headers: new Headers({ 'content-type': 'application/json', 'retry-after': '0' }),
  body: new TextEncoder().encode(JSON.stringify({ code: 'sink_busy' }))
});

describe('load runner', () => {
  it('sends at the target rate with the key as a bearer token', async () => {
    let seen: string[] = [];
    let send: HttpSend = async request => {
      seen.push(request.headers.authorization!);
      expect(request.url).toBe('http://ingest.test/v1/logs');
      expect(request.headers['content-type']).toBe('application/x-protobuf');
      return ok();
    };

    let result = await runLoad({ config: config(), stream: stream(), clock: realClock, send });
    let live = result.steps[0]!.live!;

    expect(seen.every(header => header == 'Bearer metorial_agis_test')).toBe(true);
    expect(live.offeredRecordsPerSecond).toBeGreaterThan(250);
    expect(live.offeredRecordsPerSecond).toBeLessThan(560);
    expect(live.failedDeliveries).toBe(0);
    expect(live.statusCounts['200']).toBe(live.attempts);
    expect(result.undelivered).toBe(0);
  });

  it('honours the busy signal and still delivers everything', async () => {
    let calls = 0;
    let send: HttpSend = async () => (++calls % 3 == 1 ? busy() : ok());

    let result = await runLoad({ config: config(), stream: stream(), clock: realClock, send });
    let live = result.steps[0]!.live!;

    expect(live.busyResponses).toBeGreaterThan(0);
    expect(live.statusCounts['503 sink_busy']).toBe(live.busyResponses);
    expect(live.retriedDeliveries).toBeGreaterThan(0);
    expect(live.failedDeliveries).toBe(0);
    expect(live.errorRate).toBe(0);
    expect(findKnee(result.steps, 'live').firstFailure?.reasons.join(' ')).toMatch(
      /busy rate/
    );
  });

  it('counts requests that stay busy past the retry limit as failed', async () => {
    let send: HttpSend = async () => busy();

    let result = await runLoad({
      config: config({ maxRetries: 1, stepMs: 200 }),
      stream: stream(),
      clock: realClock,
      send
    });
    let live = result.steps[0]!.live!;

    expect(live.failedDeliveries).toBeGreaterThan(0);
    expect(live.errorRate).toBe(1);
    expect(live.achievedRecordsPerSecond).toBe(0);
  });

  it('runs the backfill lane next to live and reads bulk counts', async () => {
    let paths = new Set<string>();
    let send: HttpSend = async request => {
      let path = new URL(request.url).pathname;
      paths.add(path);

      if (path == '/v1/bulk') {
        let lines = new TextDecoder().decode(request.body).trim().split('\n');
        expect(JSON.parse(lines[0]!).mode).toBe('backfill');

        return {
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          body: new TextEncoder().encode(
            JSON.stringify({ accepted: lines.length - 1, rejected: 0 })
          )
        };
      }

      return ok();
    };

    let result = await runLoad({
      config: config({
        backfillRates: [2_000],
        profile: {
          ...defaultTrafficProfile,
          backfill: { itemsPerRequest: 200, maxAgeDays: 7 }
        }
      }),
      stream: stream(),
      clock: realClock,
      send
    });

    expect([...paths].sort()).toEqual(['/v1/bulk', '/v1/logs']);
    expect(result.steps[0]!.backfill!.achievedRecordsPerSecond).toBeGreaterThan(0);
    expect(result.steps[0]!.backfill!.failedDeliveries).toBe(0);
  });

  it('reads the busy answer of the service handler and still delivers every record', async () => {
    let { sink, handle } = createInProcessIngest();
    let calls = 0;
    let send: HttpSend = async request => {
      sink.setBusy(++calls % 4 == 1);

      let response = await handle(
        new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: request.body as BodyInit
        })
      );

      return {
        status: response.status,
        headers: response.headers,
        body: new Uint8Array(await response.arrayBuffer())
      };
    };

    let result = await runLoad({
      config: config({ rates: [300], stepMs: 500, maxRetryWaitMs: 20 }),
      stream: stream(),
      clock: realClock,
      send
    });
    let live = result.steps[0]!.live!;
    let sent = live.offeredRecordsPerSecond * 0.5;

    expect(live.statusCounts['503 sink_busy']).toBeGreaterThan(0);
    expect(live.failedDeliveries).toBe(0);
    expect(live.rejectedRecords).toBe(0);
    expect(sink.list().length).toBeGreaterThanOrEqual(Math.floor(sent * 0.9));
  });

  it('marks a step client-limited when the generator cannot keep its own schedule', async () => {
    let send: HttpSend = async () => {
      await realClock.sleep(60);
      return ok();
    };

    let result = await runLoad({
      config: config({ rates: [400], stepMs: 500, concurrency: 1, maxOutstanding: 1 }),
      stream: stream(),
      clock: realClock,
      send
    });
    let knee = findKnee(result.steps, 'live');

    expect(result.steps[0]!.live!.clientWaitMs.p95).toBeGreaterThan(100);
    expect(knee.firstFailure?.limitedBy).toBe('client');
  });
});

describe('step accounting', () => {
  let delivery = (
    d: Partial<Delivery> & { scheduledAt: number; completedAt: number }
  ): Delivery => ({
    lane: 'live',
    step: 0,
    firstStartedAt: d.scheduledAt,
    firstEndedAt: d.completedAt,
    attempts: 1,
    outcome: 'ok',
    records: 10,
    accepted: 10,
    ...d
  });

  let attempt = (startedAt: number, endedAt: number, step = 0): Attempt => ({
    lane: 'live',
    step,
    startedAt,
    endedAt,
    status: 200,
    records: 10,
    rejected: 0
  });

  it('counts achieved records by the step they were scheduled in', () => {
    let deliveries = [
      delivery({ scheduledAt: 100, completedAt: 200 }),
      delivery({ scheduledAt: 900, completedAt: 1_400 }),
      delivery({ step: 1, scheduledAt: 1_100, completedAt: 1_200 })
    ];
    let attempts = [attempt(100, 200), attempt(900, 1_400), attempt(1_100, 1_200, 1)];
    let args = { lane: 'live' as const, attempts, deliveries, lags: [] };

    let first = laneStepResult({ ...args, step: 0, window: { from: 0, to: 1_000 } });
    let second = laneStepResult({ ...args, step: 1, window: { from: 1_000, to: 2_000 } });

    expect(first.achievedRecordsPerSecond).toBe(20);
    expect(second.achievedRecordsPerSecond).toBe(10);
  });

  it('measures latency and client wait from the scheduled send time', () => {
    let result = laneStepResult({
      lane: 'live',
      step: 0,
      window: { from: 0, to: 1_000 },
      attempts: [attempt(400, 450)],
      deliveries: [
        delivery({
          scheduledAt: 100,
          firstStartedAt: 400,
          firstEndedAt: 450,
          completedAt: 450
        })
      ],
      lags: []
    });

    expect(result.latencyMs.p50).toBe(50);
    expect(result.latencyFromScheduleMs.p50).toBe(350);
    expect(result.clientWaitMs.p50).toBe(300);
  });
});
