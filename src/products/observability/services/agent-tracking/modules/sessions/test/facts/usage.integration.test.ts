import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collections,
  inlineQueues,
  setupScope,
  slice,
  store,
  usd
} from '../attribution/fixtures';
import { reattributeSession } from '../../src/lib/reattribute';
import { linkService } from '@mtsrc/agent-tracking-module-entities';
import { cleanDatabase } from '@mtsrc/agent-tracking-db/test/setup';
import { usageErasureService } from '@mtsrc/agent-tracking-module-usage';
import { usageQueryService } from '@mtsrc/agent-tracking-module-usage';
import { sessionQueryService } from '../../src/services/sessionQuery';
import { usageSliceService } from '@mtsrc/agent-tracking-module-usage';

let bucket = new Date('2026-11-10T09:00:00Z');
let range = { from: new Date('2026-10-31T00:00:00Z'), to: new Date('2026-11-13T00:00:00Z') };

let setupTeams = async () => {
  inlineQueues();
  let scope = await setupScope();

  let ada = await scope.user('ada', 'ada@acme.com');
  let grace = await scope.user('grace', 'grace@acme.com');
  let payments = await scope.entity({ kind: 'team', ref: 'payments' });
  let growth = await scope.entity({ kind: 'team', ref: 'growth' });

  for (let [from, to] of [
    [ada, payments],
    [ada, growth],
    [grace, payments]
  ] as const) {
    await linkService.upsertLink({
      organization: scope.organization,
      from,
      to,
      input: { type: 'member_of', reach: 'past_30_days' }
    });
  }

  let adaSession = await scope.session({
    startedAt: bucket,
    observed: { userId: ada.id },
    summary: { costUsd: usd('10'), requests: 5 } as never
  });
  let graceSession = await scope.session({
    startedAt: bucket,
    observed: { userId: grace.id },
    summary: { costUsd: usd('4'), requests: 1 } as never
  });

  for (let [session, cost] of [
    [adaSession, '10'],
    [graceSession, '4']
  ] as const) {
    await reattributeSession({ sessionKey: session._id });
    await usageSliceService.writeSessionSlices({
      sessionKey: session._id,
      slices: [slice({ bucket, sessionsStarted: 1, costUsd: usd(cost) })]
    });
  }

  return { ...scope, ada, grace, payments, growth, adaSession, graceSession };
};

let costOf = (
  rows: { keys: Record<string, string | null>; metrics: { 'cost.usd'?: number } }[]
) =>
  Object.fromEntries(
    rows.map(row => [Object.values(row.keys).join('|'), row.metrics['cost.usd']])
  );

describe('usage and session queries', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await store.close();
  });

  it('groups usage by team with full and split allocation', async () => {
    let { organization, payments, growth } = await setupTeams();

    let query = (allocation: 'full' | 'split') =>
      usageQueryService.queryUsage({
        organization,
        query: {
          range,
          metrics: ['cost.usd', 'sessions', 'users.active'],
          groupBy: ['team'],
          filters: {},
          allocation
        }
      });

    let full = await query('full');
    expect(costOf(full.rows)).toEqual({ [payments.id]: 14, [growth.id]: 10 });
    expect(full.rows[0]!.metrics).toMatchObject({ sessions: 2, 'users.active': 2 });

    let split = await query('split');
    expect(costOf(split.rows)).toEqual({ [payments.id]: 9, [growth.id]: 5 });

    let filtered = await usageQueryService.queryUsage({
      organization,
      query: {
        range,
        metrics: ['cost.usd'],
        groupBy: ['user'],
        filters: { team: { in: [growth.id] } },
        allocation: 'split'
      }
    });
    expect(filtered.rows).toHaveLength(1);
    expect(filtered.rows[0]!.metrics['cost.usd']).toBe(5);
  });

  it('buckets by the viewer time zone and keeps daily aggregates on their own day', async () => {
    inlineQueues();
    let scope = await setupScope();
    let session = await scope.session({ startedAt: new Date('2026-11-01T04:30:00Z') });

    await usageSliceService.writeSessionSlices({
      sessionKey: session._id,
      slices: [
        slice({ bucket: new Date('2026-11-01T04:30:00Z'), costUsd: usd('8') }),
        slice({ bucket: new Date('2026-11-02T04:30:00Z'), costUsd: usd('16') }),
        slice({ bucket: new Date('2026-11-10T18:15:00Z'), costUsd: usd('1') }),
        slice({ bucket: new Date('2026-11-10T18:30:00Z'), costUsd: usd('2') }),
        slice({
          bucket: new Date('2026-11-12T00:00:00Z'),
          bucketMinutes: 1440,
          modelId: 'daily',
          costUsd: usd('4')
        })
      ]
    });

    let daily = async (timeZone: string) => {
      let result = await usageQueryService.queryUsage({
        organization: scope.organization,
        query: {
          range,
          interval: 'day',
          timeZone,
          metrics: ['cost.usd'],
          groupBy: [],
          filters: {},
          allocation: 'full'
        }
      });

      return result.rows.map(row => [row.time!.toISOString(), row.metrics['cost.usd']]);
    };

    expect(await daily('Asia/Kolkata')).toEqual([
      ['2026-10-31T18:30:00.000Z', 8],
      ['2026-11-01T18:30:00.000Z', 16],
      ['2026-11-09T18:30:00.000Z', 1],
      ['2026-11-10T18:30:00.000Z', 2],
      ['2026-11-11T18:30:00.000Z', 4]
    ]);

    expect(await daily('Asia/Kathmandu')).toEqual([
      ['2026-10-31T18:15:00.000Z', 8],
      ['2026-11-01T18:15:00.000Z', 16],
      ['2026-11-10T18:15:00.000Z', 3],
      ['2026-11-11T18:15:00.000Z', 4]
    ]);

    expect(await daily('America/New_York')).toEqual([
      ['2026-11-01T04:00:00.000Z', 24],
      ['2026-11-10T05:00:00.000Z', 3],
      ['2026-11-12T05:00:00.000Z', 4]
    ]);
  });

  it('computes session statistics per team and lists the top sessions', async () => {
    let { organization, payments, growth, adaSession, graceSession } = await setupTeams();

    let result = await sessionQueryService.querySessions({
      organization,
      query: {
        range,
        filters: {},
        groupBy: ['team'],
        stats: ['count', 'sum', 'p50'],
        metrics: ['cost.usd'],
        top: { by: 'cost.usd', limit: 5 }
      }
    });

    expect(result.groups).toEqual([
      { keys: { team: payments.id }, count: 2, stats: { 'cost.usd': { sum: 14, p50: 7 } } },
      { keys: { team: growth.id }, count: 1, stats: { 'cost.usd': { sum: 10, p50: 10 } } }
    ]);
    expect(result.top?.map(session => [session.sessionKey, session.costUsd])).toEqual([
      [adaSession._id, 10],
      [graceSession._id, 4]
    ]);
  });

  it('erases a user from slices by deleting or anonymizing', async () => {
    let { organization, ada, grace } = await setupTeams();
    let { usageSlices } = await collections();

    await usageErasureService.eraseUser({
      organizationId: organization.id,
      userId: ada.id,
      mode: 'anonymize'
    });

    let anonymized = await usageSlices.find({ organizationId: organization.id }).toArray();
    expect(anonymized).toHaveLength(2);
    expect(anonymized.some(document => document.userId == ada.id)).toBe(false);
    expect(anonymized.some(document => document.dimIds.includes(ada.id))).toBe(false);

    await usageErasureService.eraseUser({
      organizationId: organization.id,
      userId: grace.id,
      mode: 'delete'
    });

    let remaining = await usageSlices.find({ organizationId: organization.id }).toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.userId).toBeUndefined();
  });
});
