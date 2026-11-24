import { expectServiceError, uniqueEmail, useOrganization } from '@metorial/e2e';
import { claudeRequest, ingestFirstUsage } from '@metorial/agent-tracking-e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { agentTrackingMemberInsightService, type AgentTrackingMemberInsights } from '../src';
import {
  createSyncedConsumer,
  dayMs,
  haiku,
  loadCatalog,
  minuteMs,
  readScope
} from './_fixtures';

type Scope = Awaited<ReturnType<typeof readScope>>;

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

  it('ranks only the members who used the selected models and flags their main users', async () => {
    if (!catalog.present) return;

    let insights = await read({
      include: ['models'],
      modelIds: [catalog.sonnet.id],
      thresholds: { modelShareMin: 0.5 }
    });
    let { [emails.heavy]: heavy, [emails.light]: light } = byEmail(insights);

    expect(heavy).toMatchObject({
      rank: 1,
      models: { costMicros: 25000, requests: 2, costShare: 1, requestShare: 1 },
      flags: ['model_share']
    });
    expect(light).toBeUndefined();
    expect(insights.summary).toMatchObject({ members: 1, flagCounts: { model_share: 1 } });

    let haikuUsers = await read({ include: ['models'], modelIds: [catalog.haiku.id] });
    expect(haikuUsers.list.items.map(item => [item.member.email, item.rank])).toEqual([
      [emails.light, 1]
    ]);
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
});
