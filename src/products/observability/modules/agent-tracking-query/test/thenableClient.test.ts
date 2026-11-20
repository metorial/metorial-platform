import {
  badRequestError,
  ServiceError,
  timeoutError,
  tooManyRequestsError
} from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retryAfterSeconds, translateServiceError } from '../src/lib/service';
import { agentTrackingFilterValueService } from '../src/services/agentTrackingFilterValue';
import { agentTrackingMemberService } from '../src/services/agentTrackingMember';
import { agentTrackingSessionService } from '../src/services/agentTrackingSession';
import { agentTrackingSetupStatusService } from '../src/services/agentTrackingSetupStatus';
import { agentTrackingSpendService } from '../src/services/agentTrackingSpend';
import { callsTo, remoteMember, resetMocks, rpc, scope, settles } from './_mocks';

let reads: Record<string, () => Promise<unknown>> = {
  timeline: () => agentTrackingSpendService.getTimeline({ ...scope, range: {} }),
  breakdown: () =>
    agentTrackingSpendService.getBreakdown({ ...scope, groupBy: 'member', range: {} }),
  sessions: async () => (await agentTrackingSessionService.listSessions(scope)).run({}),
  session: () =>
    agentTrackingSessionService.getSession({ ...scope, sessionId: 'atse_c0ffee' }),
  filterValues: () =>
    agentTrackingFilterValueService.listFilterValues({ ...scope, field: 'member', range: {} }),
  members: () => agentTrackingMemberService.listMembers({ ...scope, page: {} }),
  setupStatus: () => agentTrackingSetupStatusService.getSetupStatus(scope)
};

let answerEverything = () => {
  rpc.handlers['query:run'] = () => ({
    rows: [
      {
        user: 'aten_ada',
        'cost.usd': 1,
        share: 1,
        last_activity: '2026-11-18T10:00:00+00:00',
        sessions: 1
      }
    ],
    totals: {},
    labels: {},
    meta: { truncated: false }
  });
  rpc.handlers['query:values'] = () => ({
    values: [{ value: 'aten_ada', label: null, count: 1 }],
    truncated: false
  });
  rpc.handlers['entity:list'] = () => ({ items: [remoteMember()], pagination: {} });
  rpc.handlers['session:list'] = () => ({
    items: [],
    pagination: { hasMoreAfter: false, hasMoreBefore: false }
  });
  rpc.handlers['session:get'] = () => ({
    sessionKey: 'c0ffee',
    instanceId: 'atin_service',
    state: 'ended',
    client: { family: 'claude-code' },
    observed: { userId: 'aten_ada' },
    summary: null,
    summaryStale: false,
    startedAt: new Date('2026-11-18T09:00:00Z'),
    lastActivityAt: new Date('2026-11-18T10:00:00Z'),
    endedAt: null
  });
  rpc.handlers['ingestSource:list'] = () => ({ items: [] });
  rpc.handlers['coverage:get'] = () => ({
    sessions: { total: 0, withoutUsage: 0, withoutRepo: 0 },
    sources: []
  });
};

describe('the agent-tracking client is never resolved through a promise', () => {
  beforeEach(() => {
    resetMocks();
    answerEverything();
  });

  for (let [name, read] of Object.entries(reads)) {
    it(`${name} settles without calling then`, async () => {
      expect(await settles(read().then(() => 'ok'))).toBe('settled');
      await expect(read()).resolves.toBeDefined();
      expect(rpc.calls.map(call => call.path)).not.toContain('then');
      expect(rpc.calls.every(call => call.path.split(':').at(-1) != 'then')).toBe(true);
    });
  }

  it('bounds every call to the service and turns off its retries', async () => {
    for (let read of Object.values(reads)) await read();

    expect(rpc.calls.length).toBeGreaterThan(0);
    for (let call of rpc.calls) {
      expect(call.opts).toMatchObject({ retry: false, captureErrors: false });
      expect(call.opts.timeoutMs).toBeGreaterThan(0);
      expect(call.opts.timeoutMs).toBeLessThanOrEqual(15_000);
    }
  });
});

let timelineRuns = () => callsTo('query:run').filter(call => call.input.query.dimensions);

// The cache key is hashed before the first query, so fake time may only move once it started.
let queryStarted = () => vi.waitUntil(() => callsTo('query:run').length > 0);

describe('service errors', () => {
  beforeEach(() => resetMocks());

  afterEach(() => vi.useRealTimers());

  it('passes a 429 on as a 429 with a retry hint', async () => {
    rpc.handlers['query:run'] = () => {
      throw new ServiceError(
        tooManyRequestsError({ message: 'At most 60 queries per minute.' })
      );
    };

    let error = await agentTrackingSpendService
      .getTimeline({ ...scope, range: {} })
      .catch(error => error);

    expect(error.data).toMatchObject({ status: 429, code: 'too_many_requests' });
    expect(error.data.retry_after_seconds).toBeGreaterThanOrEqual(1);
    expect(error.data.retry_after_seconds).toBeLessThanOrEqual(60);
    expect(error.data.hint).toMatch(/Try again in \d+ seconds/);
  });

  it('retries the concurrency limit briefly and then answers 429 with a short hint', async () => {
    vi.useFakeTimers();
    let busy = () => {
      throw new ServiceError(
        tooManyRequestsError({
          message: 'At most 4 queries can run at once.',
          reason: 'query_concurrency_limit'
        })
      );
    };
    rpc.handlers['query:run'] = busy;

    let result = agentTrackingSpendService
      .getTimeline({ ...scope, range: {} })
      .catch(error => error);
    await queryStarted();
    await vi.advanceTimersByTimeAsync(2_000);
    let error = await result;

    expect(timelineRuns()).toHaveLength(3);
    expect(error.data).toMatchObject({ status: 429, retry_after_seconds: 2 });
    expect(error.data.hint).toBe('Try again in 2 seconds.');
  });

  it('succeeds when a running query finishes during the retries', async () => {
    vi.useFakeTimers();
    let calls = 0;
    rpc.handlers['query:run'] = () => {
      calls++;
      if (calls == 1) {
        throw new ServiceError(
          tooManyRequestsError({ message: 'busy', reason: 'query_concurrency_limit' })
        );
      }
      return { rows: [], totals: {}, labels: {} };
    };

    let result = agentTrackingSpendService.getTimeline({ ...scope, range: {} });
    await queryStarted();
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toMatchObject({ items: [] });
  });

  it('does not retry the per-minute limit and passes its wait on', async () => {
    rpc.handlers['query:run'] = () => {
      throw new ServiceError(
        tooManyRequestsError({
          message: 'At most 60 queries per minute.',
          reason: 'query_rate_limit',
          retry_after_seconds: 23
        })
      );
    };

    let error = await agentTrackingSpendService
      .getTimeline({ ...scope, range: {} })
      .catch(error => error);

    expect(timelineRuns()).toHaveLength(1);
    expect(error.data).toMatchObject({ status: 429, retry_after_seconds: 23 });
  });

  it('counts the retry hint to the next minute', () => {
    expect(retryAfterSeconds(new Date('2026-11-18T12:00:45Z'))).toBe(15);
    expect(retryAfterSeconds(new Date('2026-11-18T12:00:00Z'))).toBe(60);
  });

  it('answers 503 when the service hangs until the call times out', async () => {
    vi.useFakeTimers();
    rpc.handlers['query:run'] = (_input, opts) =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new ServiceError(timeoutError())), opts.timeoutMs)
      );

    let result = agentTrackingSpendService
      .getTimeline({ ...scope, range: {} })
      .catch(error => error);
    await queryStarted();
    await vi.advanceTimersByTimeAsync(15_000);
    let error = await result;

    expect(error.data).toMatchObject({ status: 503, code: 'service_unavailable' });
  });

  it('leaves other service errors and programming errors as they are', () => {
    let invalid = new ServiceError(badRequestError({ message: 'bad' }));
    let bug = new Error('bug');

    expect(translateServiceError(invalid)).toBe(invalid);
    expect(translateServiceError(bug)).toBe(bug);
  });
});
