import { notFoundError, ServiceError } from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cacheKey } from '../src/lib/cache';
import { agentTrackingSessionService } from '../src/services/agentTrackingSession';
import { agentTrackingSpendService } from '../src/services/agentTrackingSpend';
import { cache, callsTo, resetMocks, rpc, scope, withInstanceScope } from './_mocks';

let emptyResult = () => ({ rows: [], totals: null, labels: {} });

describe('cache keys', () => {
  let base = { organizationId: 'org_1', instanceId: 'inst_1', read: 'spend.timeline' };

  it('does not depend on key order or undefined fields', async () => {
    expect(await cacheKey({ ...base, input: { a: 1, b: { c: 2, d: undefined } } })).toBe(
      await cacheKey({ ...base, input: { b: { c: 2 }, a: 1 } })
    );
  });

  it('differs by organization, instance, read and input', async () => {
    let key = await cacheKey({ ...base, input: { preset: 'today' } });

    for (let other of [
      { ...base, organizationId: 'org_2', input: { preset: 'today' } },
      { ...base, instanceId: 'inst_2', input: { preset: 'today' } },
      { ...base, read: 'spend.breakdown', input: { preset: 'today' } },
      { ...base, input: { preset: 'last_month' } }
    ]) {
      expect(await cacheKey(other)).not.toBe(key);
    }
  });
});

let timelineRuns = () => callsTo('query:run').filter(call => call.input.query.dimensions);

describe('cached reads', () => {
  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
    rpc.handlers['query:run'] = emptyResult;
  });

  afterEach(() => vi.useRealTimers());

  it('answers the same page from the cache until it expires', async () => {
    let read = () =>
      agentTrackingSpendService.getTimeline({ ...scope, range: { preset: 'today' } });

    await read();
    vi.setSystemTime(new Date('2026-11-18T12:00:59Z'));
    await read();
    expect(timelineRuns()).toHaveLength(1);

    vi.setSystemTime(new Date('2026-11-18T12:01:01Z'));
    await read();
    expect(timelineRuns()).toHaveLength(2);
  });

  it('keeps sessions for a shorter time', async () => {
    rpc.handlers['session:list'] = () => ({
      items: [],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });
    let read = async () => (await agentTrackingSessionService.listSessions(scope)).run({});

    await read();
    vi.setSystemTime(new Date('2026-11-18T12:00:31Z'));
    await read();

    expect(callsTo('session:list')).toHaveLength(2);
  });

  it('separates instances and inputs', async () => {
    await agentTrackingSpendService.getTimeline({ ...scope, range: { preset: 'today' } });
    await agentTrackingSpendService.getTimeline({ ...scope, range: { preset: 'last_month' } });
    await agentTrackingSpendService.getTimeline({
      ...scope,
      instance: { oid: 4n, id: 'inst_2', name: 'Staging' },
      range: { preset: 'today' }
    });

    expect(timelineRuns()).toHaveLength(3);
  });

  it('reads uncached when the cache itself fails', async () => {
    cache.failing = true;

    await expect(
      agentTrackingSpendService.getTimeline({ ...scope, range: { preset: 'today' } })
    ).resolves.toMatchObject({ items: [] });
    expect(timelineRuns()).toHaveLength(1);
  });

  it('reads within the instance scope and with its service id', async () => {
    await agentTrackingSpendService.getTimeline({ ...scope, range: { preset: 'today' } });
    await agentTrackingSpendService.getTimeline({ ...scope, range: { preset: 'last_month' } });

    expect(callsTo('instance:get')).toHaveLength(0);
    expect(withInstanceScope).toHaveBeenCalledTimes(2);
    expect(withInstanceScope.mock.calls[0]![0]).toEqual({
      organization: scope.organization,
      project: scope.project,
      instance: scope.instance,
      callOpts: { retry: false, captureErrors: false, timeoutMs: 5_000 }
    });
    expect(timelineRuns()[1]!.input.scope).toEqual({ instanceIds: ['atin_service'] });
  });

  it('passes a stale scope from a session read to the scope repair, not as a missing session', async () => {
    rpc.handlers['session:get'] = () => {
      throw new ServiceError(notFoundError('organization'));
    };

    await expect(
      agentTrackingSessionService.getSession({ ...scope, sessionId: 'atse_c0ffee' })
    ).rejects.toMatchObject({ data: { status: 404, entity: 'organization' } });
  });
});
