import { eventually, expectServiceError, uniqueEmail, useOrganization } from '@metorial/e2e';
import { claudeRequest, ingestFirstUsage } from '@metorial/agent-tracking-e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  agentTrackingFilterValueService,
  agentTrackingMemberInsightService,
  agentTrackingSpendService,
  type AgentTrackingMemberInsights
} from '../src';
import {
  createSyncedConsumer,
  dayMs,
  haiku,
  loadCatalog,
  minuteMs,
  readScope
} from './_fixtures';

type Scope = Awaited<ReturnType<typeof readScope>>;

let settleTimeoutMs = 120_000;

describe('module-agent-tracking-query member insights', () => {
  let org = useOrganization();

  let emails = {
    heavy: uniqueEmail('agent-tracking'),
    light: uniqueEmail('agent-tracking'),
    idle: uniqueEmail('agent-tracking')
  };
  let now = Date.now();
  let requests = [
    claudeRequest({
      email: emails.heavy,
      at: new Date(now - 20 * minuteMs),
      attributes: {
        effort: 'high',
        speed: 'fast',
        'anthropic.seat_type': 'premium',
        'anthropic.plan': 'max'
      }
    }),
    claudeRequest({
      email: emails.heavy,
      at: new Date(now - 19 * minuteMs),
      attributes: {
        effort: 'max',
        speed: 'standard',
        'anthropic.seat_type': 'premium',
        'anthropic.plan': 'max'
      }
    }),
    claudeRequest({
      email: emails.light,
      at: new Date(now - 15 * minuteMs),
      model: haiku,
      costUsd: 0.002,
      attributes: {
        effort: 'low',
        'anthropic.seat_type': 'standard',
        'anthropic.plan': 'team'
      }
    })
  ];
  let scope: Scope;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;

  let read = (
    d: Partial<Parameters<typeof agentTrackingMemberInsightService.listMemberInsights>[0]> = {}
  ) =>
    agentTrackingMemberInsightService.listMemberInsights({
      ...scope,
      page: { limit: 50 },
      ...d
    });

  let byEmail = (insights: AgentTrackingMemberInsights) =>
    Object.fromEntries(insights.list.items.map(item => [item.member.email ?? item.id, item]));

  beforeAll(async () => {
    await createSyncedConsumer(org, emails.idle);
    await ingestFirstUsage(org, requests);

    scope = await readScope(org);
    catalog = await loadCatalog(org.ids);
  }, 240_000);

  it('ranks the members with usage by cost and totals the organization', async () => {
    let insights = await read();

    expect(insights.truncated).toBe(false);
    expect(insights.list.items.map(item => [item.member.email, item.rank])).toEqual([
      [emails.heavy, 1],
      [emails.light, 2]
    ]);

    let { [emails.heavy]: heavy, [emails.light]: light } = byEmail(insights);
    expect(heavy).toMatchObject({
      requests: 2,
      sessions: 2,
      cost: { totalMicros: 25000 },
      models: null,
      practices: null,
      seat: null,
      flags: []
    });
    expect(heavy!.lastActivityAt).toBeInstanceOf(Date);
    expect(light).toMatchObject({ requests: 1, cost: { totalMicros: 2000 } });
    expect(heavy!.share! + light!.share!).toBeCloseTo(1, 6);
    expect(insights.summary).toMatchObject({
      cost: { totalMicros: 27000 },
      requests: 3,
      activeMembers: 2,
      unattributedCostMicros: 0,
      members: 2
    });
  });

  it('measures the selected models per member and flags their main users', async () => {
    if (!catalog.present) return;

    let insights = await read({
      include: ['models'],
      modelIds: [catalog.sonnet.id],
      thresholds: { modelShareMin: 0.5 }
    });
    let { [emails.heavy]: heavy, [emails.light]: light } = byEmail(insights);

    expect(heavy).toMatchObject({
      models: { costMicros: 25000, requests: 2, costShare: 1, requestShare: 1 },
      flags: ['model_share']
    });
    expect(light).toMatchObject({
      models: { costMicros: 0, requests: 0, costShare: 0, requestShare: 0 },
      flags: []
    });
    expect(insights.summary.flagCounts.model_share).toBe(1);

    let byShare = await read({
      include: ['models'],
      modelIds: [catalog.sonnet.id],
      sort: 'model_share',
      page: { limit: 50, order: 'asc' }
    });
    expect(byShare.list.items.map(item => item.member.email)).toEqual([
      emails.light,
      emails.heavy
    ]);
  });

  it('counts reasoning effort and speed from request records', async () => {
    let insights = await eventually(
      async () => {
        let result = await read({ include: ['practices'] });
        expect(result.summary.practices!.requestsMeasured).toBe(3);
        return result;
      },
      { timeoutMs: settleTimeoutMs, intervalMs: 1000 }
    );
    let { [emails.heavy]: heavy, [emails.light]: light } = byEmail(insights);

    expect(heavy!.practices).toMatchObject({
      requestsMeasured: 2,
      highEffortRequests: 1,
      maxEffortRequests: 1,
      requestsWithEffort: 2,
      highEffortShare: 1,
      fastRequests: 1,
      fastShare: 0.5
    });
    expect(light!.practices).toMatchObject({
      requestsMeasured: 1,
      highEffortRequests: 0,
      requestsWithEffort: 1,
      highEffortShare: 0,
      fastRequests: 0,
      fastShare: null
    });
    expect(insights.summary.practices).toMatchObject({
      requestsMeasured: 3,
      highEffortRequests: 1,
      maxEffortRequests: 1
    });
  });

  it('reports the seat and plan seen most and flags low use of the named seats', async () => {
    let insights = await eventually(
      async () => {
        let result = await read({
          include: ['seat'],
          thresholds: { seatUsageMaxMicros: 10_000_000 },
          seats: ['standard']
        });
        expect(result.list.items.every(item => item.seat!.seat !== null)).toBe(true);
        return result;
      },
      { timeoutMs: settleTimeoutMs, intervalMs: 1000 }
    );
    let { [emails.heavy]: heavy, [emails.light]: light } = byEmail(insights);

    expect(heavy!.seat).toMatchObject({ seat: 'premium', plan: 'max' });
    expect(light!.seat).toMatchObject({ seat: 'standard', plan: 'team' });
    expect(heavy!.flags).toEqual([]);
    expect(light!.flags).toEqual(['low_usage_seat']);
    expect(insights.summary.seat).toEqual({ unknownSeatMembers: 0 });
  });

  it('lists a member without usage with zero figures, flagged only as a low usage seat', async () => {
    let insights = await read({
      include: ['practices', 'seat'],
      includeInactive: true,
      thresholds: {
        highEffortShareMin: 0,
        outdatedShareMin: 0,
        cacheHitRateMax: 1,
        seatUsageMaxMicros: 1
      }
    });
    let idle = byEmail(insights)[emails.idle];

    expect(idle).toMatchObject({
      requests: 0,
      sessions: 0,
      cost: { totalMicros: 0 },
      lastActivityAt: null,
      practices: { requestsMeasured: 0, highEffortShare: null, cacheHitRate: null },
      seat: { seat: null, listPriceMicros: 0 },
      flags: ['low_usage_seat']
    });
    expect(idle!.rank).toBeGreaterThan(byEmail(insights)[emails.light]!.rank);
    expect(insights.summary.activeMembers).toBe(2);

    let withoutInactive = await read({ include: ['practices', 'seat'] });
    expect(byEmail(withoutInactive)[emails.idle]).toBeUndefined();
  });

  it('refuses practices and seat over more than 90 days', async () => {
    let to = new Date();
    let range = { from: new Date(to.getTime() - 120 * dayMs), to };

    await expectServiceError(read({ include: ['practices'], range }), 'bad_request');
    await expectServiceError(read({ include: ['seat'], range }), 'bad_request');
    expect((await read({ range })).list.items.length).toBeGreaterThan(0);
  });

  it('offers the seats seen as filter values', async () => {
    let seats = await eventually(
      async () => {
        let result = await agentTrackingFilterValueService.listFilterValues({
          ...scope,
          field: 'seat',
          range: { preset: 'last_7_days' }
        });
        expect(result.items.map(item => item.value).sort()).toEqual(['premium', 'standard']);
        return result;
      },
      { timeoutMs: settleTimeoutMs, intervalMs: 1000 }
    );
    expect(seats.items.every(item => item.kind == 'seat')).toBe(true);
  });

  it('breaks the spend of one member down by model', async () => {
    let insights = await read();
    let light = byEmail(insights)[emails.light]!;

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: { preset: 'last_7_days' },
      filters: { memberIds: [light.id] }
    });

    expect(breakdown.total).toMatchObject({ requests: 1, cost: { totalMicros: 2000 } });
    expect(breakdown.items).toHaveLength(1);
    if (catalog.present) expect(breakdown.items[0]!.model!.id).toBe(catalog.haiku.id);
  });
});
