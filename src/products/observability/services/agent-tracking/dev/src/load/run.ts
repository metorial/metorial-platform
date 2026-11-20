import type { Clock } from '../lib/clock';
import { createSampler, seedOf } from '../lib/random';
import { ratio, round, summarize, type Summary } from '../lib/stats';
import {
  backfillItems,
  encodeBackfillRequest,
  encodeLiveRequest,
  rejectedOfOtlpResponse,
  type Compression,
  type EncodedRequest,
  type PayloadFormat
} from './payload';
import type { TrafficProfile } from './profile';
import { createPacer, retryDelayMs } from './rate';
import type { BatchStream } from './synth';

export type Lane = 'live' | 'backfill';

export type LoadConfig = {
  url: string;
  key: string;
  rates: number[];
  backfillRates: number[] | null;
  stepMs: number;
  warmupMs: number;
  concurrency: number;
  maxOutstanding: number;
  maxRetries: number;
  maxRetryWaitMs: number;
  requestTimeoutMs: number;
  drainTimeoutMs: number;
  format: PayloadFormat;
  compression: Compression;
  profile: TrafficProfile;
  seed: number;
  liveEnabled: boolean;
};

export type Attempt = {
  lane: Lane;
  step: number;
  startedAt: number;
  endedAt: number;
  status: number;
  code?: string;
  records: number;
  rejected: number;
};

export type Delivery = {
  lane: Lane;
  step: number;
  scheduledAt: number;
  firstStartedAt: number;
  firstEndedAt: number;
  completedAt: number;
  attempts: number;
  outcome: 'ok' | 'failed';
  records: number;
  accepted: number;
};

export type LaneStepResult = {
  offeredRecordsPerSecond: number;
  achievedRecordsPerSecond: number;
  attempts: number;
  statusCounts: Record<string, number>;
  latencyMs: Summary;
  latencyFromScheduleMs: Summary;
  clientWaitMs: Summary;
  deliveryLatencyMs: Summary;
  busyResponses: number;
  busyRate: number;
  retriedDeliveries: number;
  failedDeliveries: number;
  errorRate: number;
  rejectedRecords: number;
  scheduleLagMs: Summary;
};

export type StepResult = {
  step: number;
  targetRecordsPerSecond: number;
  backfillRecordsPerSecond: number | null;
  windowMs: number;
  live: LaneStepResult | null;
  backfill: LaneStepResult | null;
};

export type HttpSend = (request: {
  url: string;
  headers: Record<string, string>;
  body: Uint8Array;
  timeoutMs: number;
}) => Promise<{ status: number; headers: Headers; body: Uint8Array }>;

export let fetchSend: HttpSend = async request => {
  try {
    let response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body as BodyInit,
      signal: AbortSignal.timeout(request.timeoutMs)
    });

    return {
      status: response.status,
      headers: response.headers,
      body: new Uint8Array(await response.arrayBuffer())
    };
  } catch {
    return { status: 0, headers: new Headers(), body: new Uint8Array() };
  }
};

let createSemaphore = (limit: number) => {
  let active = 0;
  let waiting: (() => void)[] = [];

  return {
    acquire: async () => {
      if (active < limit) {
        active++;
        return;
      }

      await new Promise<void>(resolve => waiting.push(resolve));
    },

    release: () => {
      let next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
};

let isRetryable = (status: number) =>
  status == 0 || status == 429 || status == 502 || status == 503 || status == 504;

let errorCodeOf = (body: Uint8Array, headers: Headers) => {
  if (!headers.get('content-type')?.includes('json') || body.length == 0) return undefined;

  try {
    let parsed = JSON.parse(new TextDecoder().decode(body));
    return typeof parsed?.code == 'string' ? parsed.code : undefined;
  } catch {
    return undefined;
  }
};

let acceptedOf = (request: EncodedRequest, body: Uint8Array, headers: Headers) => {
  if (request.lane == 'live') {
    let rejected = rejectedOfOtlpResponse(body, headers.get('content-type'));
    return { accepted: request.records - rejected, rejected };
  }

  let parsed = JSON.parse(new TextDecoder().decode(body)) as {
    accepted: number;
    rejected: number;
  };

  return { accepted: parsed.accepted, rejected: parsed.rejected };
};

export let runLoad = async (d: {
  config: LoadConfig;
  stream: BatchStream;
  clock: Clock;
  send?: HttpSend;
  onStep?: (step: StepResult) => void;
}) => {
  let { config, clock } = d;
  let send = d.send ?? fetchSend;
  let semaphore = createSemaphore(config.concurrency);
  let jitter = createSampler(seedOf(config.seed, 'jitter'));
  let attempts: Attempt[] = [];
  let deliveries: Delivery[] = [];
  let lags: { lane: Lane; step: number; lagMs: number }[] = [];
  let outstanding = new Set<Promise<void>>();
  let backfillBatch = 0;
  let base = config.url.replace(/\/+$/, '');

  let deliver = async (request: EncodedRequest, step: number, scheduledAt: number) => {
    let attempt = 0;
    let first: { startedAt: number; endedAt: number } | null = null;

    while (true) {
      await semaphore.acquire();

      let startedAt = clock.now();
      let response = await send({
        url: `${base}${request.path}`,
        headers: { ...request.headers, authorization: `Bearer ${config.key}` },
        body: request.body,
        timeoutMs: config.requestTimeoutMs
      });
      let endedAt = clock.now();

      semaphore.release();
      first ??= { startedAt, endedAt };

      let code =
        response.status == 200 ? undefined : errorCodeOf(response.body, response.headers);
      let counts = { accepted: 0, rejected: 0 };

      if (response.status == 200) {
        try {
          counts = acceptedOf(request, response.body, response.headers);
        } catch {
          counts = { accepted: 0, rejected: request.records };
        }
      }

      attempts.push({
        lane: request.lane,
        step,
        startedAt,
        endedAt,
        status: response.status,
        code,
        records: response.status == 200 ? counts.accepted : 0,
        rejected: counts.rejected
      });

      if (response.status == 200) {
        deliveries.push({
          lane: request.lane,
          step,
          scheduledAt,
          firstStartedAt: first.startedAt,
          firstEndedAt: first.endedAt,
          completedAt: endedAt,
          attempts: attempt + 1,
          outcome: 'ok',
          records: request.records,
          accepted: counts.accepted
        });
        return;
      }

      if (!isRetryable(response.status) || attempt >= config.maxRetries) {
        deliveries.push({
          lane: request.lane,
          step,
          scheduledAt,
          firstStartedAt: first.startedAt,
          firstEndedAt: first.endedAt,
          completedAt: endedAt,
          attempts: attempt + 1,
          outcome: 'failed',
          records: request.records,
          accepted: 0
        });
        return;
      }

      await clock.sleep(
        retryDelayMs({
          retryAfter: response.headers.get('retry-after'),
          attempt,
          now: Date.now(),
          jitter: jitter.next(),
          maxMs: config.maxRetryWaitMs
        })
      );
      attempt++;
    }
  };

  let track = (promise: Promise<void>) => {
    outstanding.add(promise);
    promise.finally(() => outstanding.delete(promise));
  };

  let waitForRoom = async () => {
    while (outstanding.size >= config.maxOutstanding) await Promise.race(outstanding);
  };

  let laneLoop = async (d2: {
    lane: Lane;
    step: number;
    rate: number;
    endAt: number;
    next: () => EncodedRequest;
  }) => {
    let pacer = createPacer({ ratePerSecond: d2.rate, startAt: clock.now(), clock });

    while (pacer.nextAt() < d2.endAt) {
      let request = d2.next();
      let slot = await pacer.take(request.records);

      if (slot.scheduledAt >= d2.endAt) break;

      await waitForRoom();
      lags.push({ lane: d2.lane, step: d2.step, lagMs: clock.now() - slot.scheduledAt });
      track(deliver(request, d2.step, slot.scheduledAt));
    }
  };

  let steps: StepResult[] = [];
  let windows: { from: number; to: number }[] = [];

  for (let step = 0; step < config.rates.length; step++) {
    let rate = config.rates[step]!;
    let startAt = clock.now();
    let endAt = startAt + config.stepMs;
    let loops: Promise<void>[] = [];

    if (config.liveEnabled) {
      loops.push(
        laneLoop({
          lane: 'live',
          step,
          rate,
          endAt,
          next: () => {
            let batch = d.stream.next();
            return encodeLiveRequest(batch.group, batch.expected.length, {
              format: config.format,
              compression: config.compression
            });
          }
        })
      );
    }

    let backfillRate = config.backfillRates?.[step];

    if (backfillRate) {
      loops.push(
        laneLoop({
          lane: 'backfill',
          step,
          rate: backfillRate,
          endAt,
          next: () => {
            let now = Date.now();
            let number = backfillBatch++;

            return encodeBackfillRequest(
              backfillItems({
                profile: config.profile,
                seed: config.seed,
                batchNumber: number,
                now
              }),
              {
                batchId: `loadtest-${config.seed}-${number}`,
                now,
                compression: config.compression
              }
            );
          }
        })
      );
    }

    await Promise.all(loops);

    let remaining = endAt - clock.now();
    if (remaining > 0) await clock.sleep(remaining);

    let window = { from: startAt + config.warmupMs, to: endAt };
    let result = stepResult({ step, rate, window, config, attempts, deliveries, lags });

    windows.push(window);
    steps.push(result);
    d.onStep?.(result);
  }

  let drainUntil = clock.now() + config.drainTimeoutMs;
  while (outstanding.size > 0 && clock.now() < drainUntil) {
    await Promise.race([...outstanding, clock.sleep(250)]);
  }

  let finalSteps = steps.map(step =>
    stepResult({
      step: step.step,
      rate: step.targetRecordsPerSecond,
      window: windows[step.step]!,
      config,
      attempts,
      deliveries,
      lags
    })
  );

  return { steps: finalSteps, undelivered: outstanding.size };
};

// Rates and errors follow the requests scheduled inside the step's window, so one step's
// stragglers never count for the next. Status, busy and per-attempt latency follow the attempts
// that started inside it, which is what the service saw during the step.
export let laneStepResult = (d: {
  lane: Lane;
  step: number;
  window: { from: number; to: number };
  attempts: Attempt[];
  deliveries: Delivery[];
  lags: { lane: Lane; step: number; lagMs: number }[];
}): LaneStepResult => {
  let inWindow = (at: number) => at >= d.window.from && at < d.window.to;
  let windowSeconds = Math.max(0.001, (d.window.to - d.window.from) / 1000);

  let laneAttempts = d.attempts.filter(a => a.lane == d.lane);
  let measured = laneAttempts.filter(a => inWindow(a.startedAt));
  let stepDeliveries = d.deliveries.filter(a => a.lane == d.lane && a.step == d.step);
  let measuredDeliveries = stepDeliveries.filter(a => inWindow(a.scheduledAt));

  let statusCounts: Record<string, number> = {};
  for (let attempt of measured) {
    let key = attempt.code ? `${attempt.status} ${attempt.code}` : String(attempt.status);
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }

  let busy = measured.filter(a => a.status == 503 || a.status == 429).length;
  let failed = measuredDeliveries.filter(a => a.outcome == 'failed').length;
  let offered = measuredDeliveries.reduce((sum, a) => sum + a.records, 0);
  let achieved = measuredDeliveries
    .filter(a => a.outcome == 'ok')
    .reduce((sum, a) => sum + a.accepted, 0);

  return {
    offeredRecordsPerSecond: round(offered / windowSeconds, 1)!,
    achievedRecordsPerSecond: round(achieved / windowSeconds, 1)!,
    attempts: measured.length,
    statusCounts,
    latencyMs: summarize(measured.map(a => a.endedAt - a.startedAt)),
    latencyFromScheduleMs: summarize(
      measuredDeliveries.map(a => a.firstEndedAt - a.scheduledAt)
    ),
    clientWaitMs: summarize(measuredDeliveries.map(a => a.firstStartedAt - a.scheduledAt)),
    deliveryLatencyMs: summarize(
      measuredDeliveries.filter(a => a.outcome == 'ok').map(a => a.completedAt - a.scheduledAt)
    ),
    busyResponses: busy,
    busyRate: round(ratio(busy, measured.length), 4)!,
    retriedDeliveries: measuredDeliveries.filter(a => a.attempts > 1).length,
    failedDeliveries: failed,
    errorRate: round(ratio(failed, measuredDeliveries.length), 4)!,
    rejectedRecords: measured.reduce((sum, a) => sum + a.rejected, 0),
    scheduleLagMs: summarize(
      d.lags.filter(lag => lag.lane == d.lane && lag.step == d.step).map(lag => lag.lagMs)
    )
  };
};

let stepResult = (d: {
  step: number;
  rate: number;
  window: { from: number; to: number };
  config: LoadConfig;
  attempts: Attempt[];
  deliveries: Delivery[];
  lags: { lane: Lane; step: number; lagMs: number }[];
}): StepResult => {
  let args = {
    step: d.step,
    window: d.window,
    attempts: d.attempts,
    deliveries: d.deliveries,
    lags: d.lags
  };

  return {
    step: d.step,
    targetRecordsPerSecond: d.rate,
    backfillRecordsPerSecond: d.config.backfillRates?.[d.step] ?? null,
    windowMs: d.window.to - d.window.from,
    live: d.config.liveEnabled ? laneStepResult({ lane: 'live', ...args }) : null,
    backfill: d.config.backfillRates?.[d.step]
      ? laneStepResult({ lane: 'backfill', ...args })
      : null
  };
};
