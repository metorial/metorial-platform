import {
  expectServiceError,
  firstPage,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import {
  claudeRequest,
  ingestFirstUsage,
  type ClaudeCodeRequest
} from '@metorial/agent-tracking-e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  agentTrackingFilterValueService,
  agentTrackingMemberService,
  agentTrackingSessionService,
  agentTrackingSetupStatusService,
  agentTrackingSpendService,
  type AgentTrackingSessionView,
  type AgentTrackingSpendFilters
} from '../src';
import {
  createSyncedConsumer,
  dayMs,
  haiku,
  isoDate,
  loadCatalog,
  madeUpModel,
  minuteMs,
  readScope,
  sonnet
} from './_fixtures';

type Scope = Awaited<ReturnType<typeof readScope>>;

let lastWeek = { preset: 'last_7_days' as const };

let zeroCost = {
  totalMicros: 0,
  listPriceMicros: 0,
  isEstimate: false,
  billedMicros: null,
  requestsWithoutCost: 0,
  requestsWithoutListPrice: 0
};

let small = (request: Partial<ClaudeCodeRequest>) =>
  claudeRequest({ cacheReadTokens: 0, cacheCreationTokens: 0, ...request });

let sumOf = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

let sessions = async (scope: Scope, filters: Record<string, unknown> = {}) =>
  await firstPage(await agentTrackingSessionService.listSessions({ ...scope, ...filters }));

describe('module-agent-tracking-query reads of an instance without usage', () => {
  let org = useOrganization();

  it('returns one zero day per calendar day of a preset range', async () => {
    let timeline = await agentTrackingSpendService.getTimeline({
      ...(await readScope(org)),
      range: { preset: 'last_7_days', timeZone: 'Europe/Berlin' }
    });

    expect(timeline.range).toMatchObject({ preset: 'last_7_days', timeZone: 'Europe/Berlin' });
    expect(timeline.interval).toBe('day');
    expect(timeline.items).toHaveLength(7);
    expect(new Set(timeline.items.map(item => item.date)).size).toBe(7);
    for (let item of timeline.items) {
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item).toMatchObject({ hidden: false, requests: 0, cost: zeroCost });
    }
  });

  it('counts no sessions or members and compares with an empty previous period', async () => {
    let scope = await readScope(org);
    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_7_days', timeZone: 'Europe/Berlin' }
    });

    expect(timeline.counts).toEqual({ sessions: 0, members: 0, capped: false });
    expect(timeline.previous).toMatchObject({
      range: { preset: null, to: timeline.range.from, timeZone: 'Europe/Berlin' },
      total: { requests: 0, cost: { totalMicros: 0, billedMicros: null } },
      startsBeforeRetention: false
    });
    expect(timeline.previous.range.to.getTime() - timeline.previous.range.from.getTime()).toBe(
      timeline.range.to.getTime() - timeline.range.from.getTime()
    );

    let lastMonth = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { preset: 'last_month' }
    });
    expect(lastMonth.previous.range.to).toEqual(lastMonth.range.from);
    expect(lastMonth.previous.range.from.getUTCDate()).toBe(1);
  });

  it('returns exactly the days of an explicit range', async () => {
    let timeline = await agentTrackingSpendService.getTimeline({
      ...(await readScope(org)),
      range: {
        from: new Date('2026-11-01T00:00:00.000Z'),
        to: new Date('2026-11-04T00:00:00.000Z')
      }
    });

    expect(timeline.range).toMatchObject({ preset: null, timeZone: 'UTC' });
    expect(timeline.items.map(item => item.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03'
    ]);
  });

  it('always offers Unknown Member and Unknown Model as filter values', async () => {
    let scope = await readScope(org);
    let unknown = {
      value: 'unknown',
      kind: 'unknown',
      member: null,
      model: null,
      client: null,
      requests: null
    };

    let members = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'member',
      range: {}
    });
    expect(members.items.at(-1)).toEqual(unknown);

    let models = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'model',
      range: {}
    });
    expect(models.items).toEqual([unknown]);
  });

  it('reports setup status before any data arrives', async () => {
    let status = await agentTrackingSetupStatusService.getSetupStatus(await readScope(org));

    expect(status).toEqual({
      lastReceivedAt: null,
      options: {
        usageAndCost: 'not_detected',
        keepLocalHistory: 'undetectable',
        repository: 'not_detected',
        toolDetails: 'not_detected',
        hooks: 'not_detected'
      }
    });
  });
});

describe('module-agent-tracking-query reads of ingested usage', () => {
  let org = useOrganization();

  let matchedEmail = uniqueEmail('agent-tracking');
  let unmatchedEmail = uniqueEmail('agent-tracking');
  let now = Date.now();
  let sessionIds = {
    matched: uniqueId('session'),
    unmatched: uniqueId('session'),
    anonymous: uniqueId('session')
  };
  let requests = [
    claudeRequest({
      sessionId: sessionIds.matched,
      email: matchedEmail,
      at: new Date(now - 20 * minuteMs)
    }),
    claudeRequest({
      sessionId: sessionIds.matched,
      email: matchedEmail,
      at: new Date(now - 19 * minuteMs)
    }),
    small({
      sessionId: sessionIds.unmatched,
      email: unmatchedEmail,
      at: new Date(now - 15 * minuteMs),
      model: haiku,
      inputTokens: 500,
      outputTokens: 50,
      costUsd: 0.002
    }),
    small({
      sessionId: sessionIds.anonymous,
      at: new Date(now - 10 * minuteMs),
      model: madeUpModel,
      inputTokens: 300,
      outputTokens: 30,
      costUsd: 0.001
    })
  ];
  let scope: Scope;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;

  let nameOf = (session: AgentTrackingSessionView) =>
    session.member?.email == matchedEmail
      ? 'matched'
      : session.member?.email == unmatchedEmail
        ? 'unmatched'
        : 'anonymous';

  beforeAll(async () => {
    await createSyncedConsumer(org, matchedEmail);
    await ingestFirstUsage(org, requests);

    scope = await readScope(org);
    catalog = await loadCatalog(org.ids);
  }, 240_000);

  it('lists the sessions most recently active first, with member, tokens and cost', async () => {
    let listed = await sessions(scope);
    expect(listed.map(nameOf)).toEqual(['anonymous', 'unmatched', 'matched']);

    for (let session of listed) {
      expect(session.id.startsWith('atse_')).toBe(true);
      expect(session.summaryPending).toBe(false);
      expect(session.client).toMatchObject({ family: 'claude_code', name: 'Claude Code' });
    }

    expect(listed.map(session => [session.models, session.unknownModelNames])).toEqual(
      catalog.present
        ? [
            [[], [madeUpModel]],
            [[catalog.haiku], []],
            [[catalog.sonnet], []]
          ]
        : [
            [[], [madeUpModel]],
            [[], [haiku]],
            [[], [sonnet]]
          ]
    );

    let [anonymous, unmatched, matched] = listed;
    expect(matched).toMatchObject({
      requests: 2,
      tokens: { input: 2000, cacheRead: 6000, cacheWrite: 800, output: 400, total: 9200 },
      cost: { totalMicros: 25000, reportedByClientMicros: 25000 },
      member: { matched: true, email: matchedEmail, consumer: { email: matchedEmail } }
    });
    expect(unmatched).toMatchObject({
      requests: 1,
      tokens: { input: 500, output: 50, total: 550 },
      cost: { totalMicros: 2000 },
      member: { matched: false, email: unmatchedEmail, consumer: null }
    });
    expect(anonymous).toMatchObject({
      requests: 1,
      tokens: { input: 300, output: 30, total: 330 },
      cost: { totalMicros: 1000 },
      member: null
    });
  });

  it('orders sessions by cost in both directions', async () => {
    let paginator = await agentTrackingSessionService.listSessions({
      ...scope,
      orderBy: 'cost'
    });

    let descending = (await paginator.run({ limit: 10 })).items;
    expect(descending.map(session => session.cost.totalMicros)).toEqual([25000, 2000, 1000]);

    let ascending = (await paginator.run({ limit: 10, order: 'asc' })).items;
    expect(ascending.map(session => session.cost.totalMicros)).toEqual([1000, 2000, 25000]);
  });

  it('lists only sessions last active in a range', async () => {
    let [newest] = await sessions(scope);
    let lastActive = newest!.lastActivityAt.getTime();

    let recent = await sessions(scope, {
      range: { from: new Date(lastActive), to: new Date(lastActive + minuteMs) }
    });
    expect(recent.map(nameOf)).toEqual(['anonymous']);

    let before = await sessions(scope, {
      orderBy: 'cost',
      range: { from: new Date(lastActive - 60 * minuteMs), to: new Date(lastActive) }
    });
    expect(before.map(nameOf)).toEqual(['matched', 'unmatched']);
  });

  it('filters sessions by member, Unknown Member, model and client', async () => {
    let listed = await sessions(scope);
    let matched = listed.find(session => nameOf(session) == 'matched')!;
    let names = async (filters: Record<string, unknown>) =>
      (await sessions(scope, filters)).map(nameOf).sort();

    expect(await names({ memberIds: [matched.member!.id] })).toEqual(['matched']);
    expect(await names({ memberIds: ['unknown'] })).toEqual(['anonymous']);

    if (catalog.present) {
      expect(await names({ modelIds: [catalog.sonnet.id] })).toEqual(['matched']);
      expect(await names({ modelIds: [catalog.haiku.id] })).toEqual(['unmatched']);
      expect(await names({ modelIds: ['unknown'] })).toEqual(['anonymous']);
      expect(await names({ modelIds: ['unknown', catalog.sonnet.id] })).toEqual([
        'anonymous',
        'matched'
      ]);
    } else {
      expect(await names({ modelIds: ['unknown'] })).toEqual([
        'anonymous',
        'matched',
        'unmatched'
      ]);
    }
    expect(await names({ modelIds: ['no-such-model'] })).toEqual([]);

    expect(await names({ clientFamilies: ['claude_code'] })).toEqual([
      'anonymous',
      'matched',
      'unmatched'
    ]);
    expect(await names({ clientFamilies: ['cursor'] })).toEqual([]);
  });

  it('returns one session with its usage per model', async () => {
    let row = (await sessions(scope)).find(session => nameOf(session) == 'matched')!;

    let session = await agentTrackingSessionService.getSession({
      ...scope,
      sessionId: row.id
    });
    let { usageByModel, ...view } = session;
    expect({ ...view, state: row.state }).toEqual(row);

    expect(usageByModel).toHaveLength(1);
    expect(usageByModel[0]).toMatchObject({
      ...(catalog.present
        ? {
            kind: 'model',
            key: catalog.sonnet.id,
            model: catalog.sonnet,
            unknownModelNames: []
          }
        : { kind: 'unknown', key: 'unknown', model: null, unknownModelNames: [sonnet] }),
      share: 1,
      requests: 2,
      tokens: { input: 2000, cacheRead: 6000, cacheWrite: 800, output: 400, total: 9200 },
      cost: {
        totalMicros: 25000,
        billedMicros: null,
        estimatedMicros: 25000,
        isEstimate: true,
        requestsWithoutCost: 0
      }
    });

    for (let sessionId of [`atse_${uniqueId('missing')}`, uniqueId('ses')]) {
      await expectServiceError(
        agentTrackingSessionService.getSession({ ...scope, sessionId }),
        'not_found'
      );
    }
  });

  it('totals the spend of the range, per day and in the breakdowns', async () => {
    let timeline = await agentTrackingSpendService.getTimeline({ ...scope, range: lastWeek });

    expect(timeline.total).toMatchObject({
      requests: 4,
      cost: { totalMicros: 28000, reportedByClientMicros: 28000, requestsWithoutCost: 0 },
      tokens: { input: 2800, cacheRead: 6000, cacheWrite: 800, output: 480, total: 10080 }
    });
    if (catalog.present) {
      expect(timeline.total.cost.requestsWithoutListPrice).toBe(1);
      expect(timeline.total.cost.listPriceMicros).not.toBeNull();
    } else {
      expect(timeline.total.cost).toMatchObject({
        requestsWithoutListPrice: 4,
        listPriceMicros: null
      });
    }

    let expectedDays = [...new Set(requests.map(request => isoDate(request.at)))]
      .sort()
      .map(date => {
        let onDay = requests.filter(request => isoDate(request.at) == date);
        return [
          date,
          onDay.length,
          {
            sessions: new Set(onDay.map(request => request.sessionId)).size,
            members: new Set(onDay.flatMap(request => request.email ?? [])).size
          }
        ];
      });
    expect(
      timeline.items
        .filter(item => item.requests)
        .map(item => [item.date, item.requests, item.counts])
    ).toEqual(expectedDays);
    expect(sumOf(timeline.items, item => item.tokens!.total)).toBe(10080);

    for (let groupBy of ['member', 'model'] as const) {
      let breakdown = await agentTrackingSpendService.getBreakdown({
        ...scope,
        groupBy,
        range: lastWeek
      });
      expect(breakdown.total).toMatchObject({ requests: 4, cost: { totalMicros: 28000 } });
      expect(sumOf(breakdown.items, item => item.requests)).toBe(4);
    }
  });

  it('counts the sessions and members of the range and totals the period before it', async () => {
    let timeline = await agentTrackingSpendService.getTimeline({ ...scope, range: lastWeek });

    expect(timeline.counts).toEqual({ sessions: 3, members: 2, capped: false });
    expect(timeline.previous.range.to).toEqual(timeline.range.from);
    expect(timeline.previous.total).toMatchObject({ requests: 0, cost: { totalMicros: 0 } });

    let later = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: {
        from: timeline.range.to,
        to: new Date(timeline.range.to.getTime() + 7 * dayMs)
      }
    });
    expect(later.counts).toEqual({ sessions: 0, members: 0, capped: false });
    expect(later.previous.range.to).toEqual(timeline.range.to);
    expect(later.previous.total).toMatchObject({ requests: 4, cost: { totalMicros: 28000 } });
  });

  it('applies client and model filters to every spend figure', async () => {
    let read = async (filters: AgentTrackingSpendFilters) =>
      await agentTrackingSpendService.getTimeline({ ...scope, range: lastWeek, filters });

    let unfiltered = await read({});
    let claudeCode = await read({ clientFamilies: ['claude_code'] });
    expect(claudeCode.total).toEqual(unfiltered.total);
    expect(claudeCode.counts).toEqual(unfiltered.counts);
    expect(claudeCode.items.map(item => item.counts)).toEqual(
      unfiltered.items.map(item => item.counts)
    );
    expect(await read({ clientFamilies: ['claude-code'] })).toEqual(claudeCode);

    let models = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: lastWeek
    });
    let expected: [string, number, number][] = catalog.present
      ? [
          [catalog.sonnet.id, 2, 25000],
          [catalog.haiku.id, 1, 2000],
          ['unknown', 1, 1000]
        ]
      : [['unknown', 4, 28000]];
    expect(models.items.map(item => item.key).sort()).toEqual(
      expected.map(([key]) => key).sort()
    );

    for (let [key, requests, cost] of expected) {
      let byModel = await read({ clientFamilies: ['claude_code'], modelIds: [key] });

      expect(byModel.total.requests).toBe(requests);
      expect(byModel.total.cost.totalMicros).toBe(cost);
      expect(byModel.counts!.sessions).toBe(requests == 4 ? 3 : 1);
      let item = models.items.find(item => item.key == key)!;
      expect(byModel.total).toEqual({
        requests: item.requests,
        cost: item.cost,
        tokens: item.tokens
      });
    }

    for (let filters of [
      { clientFamilies: ['cursor'] },
      { clientFamilies: ['claude_code'], modelIds: ['no-such-model'] }
    ]) {
      let none = await read(filters);
      expect(none.total).toMatchObject({ requests: 0, cost: { totalMicros: 0 } });
      expect(none.counts).toEqual({ sessions: 0, members: 0, capped: false });
      expect(none.items.every(item => item.counts!.sessions == 0)).toBe(true);

      let breakdown = await agentTrackingSpendService.getBreakdown({
        ...scope,
        groupBy: 'member',
        range: lastWeek,
        filters
      });
      expect(breakdown.items).toEqual([]);
      expect(breakdown.total.requests).toBe(0);
    }
  });

  it('breaks spend down by member, with Unknown Member for usage without an email', async () => {
    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'member',
      range: lastWeek
    });

    expect(breakdown.items.map(item => item.kind)).toEqual(['member', 'member', 'unknown']);

    let [matched, unmatched, unknown] = breakdown.items;
    expect(matched).toMatchObject({
      requests: 2,
      cost: { totalMicros: 25000 },
      member: { matched: true, email: matchedEmail }
    });
    expect(unmatched).toMatchObject({
      requests: 1,
      cost: { totalMicros: 2000 },
      member: { matched: false, email: unmatchedEmail }
    });
    expect(unknown).toMatchObject({
      key: 'unknown',
      member: null,
      requests: 1,
      cost: { totalMicros: 1000 }
    });
    expect(matched!.share).toBeGreaterThan(unmatched!.share!);
    expect(unmatched!.share).toBeGreaterThan(unknown!.share!);
    for (let item of breakdown.items) expect(item.unknownModelNames).toEqual([]);
  });

  it('breaks spend down by model and names the models behind Unknown Model', async () => {
    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'model',
      range: lastWeek
    });

    let byKey = (items: any[]) =>
      items
        .map(item => ({
          kind: item.kind,
          key: item.key,
          model: item.model,
          requests: item.requests,
          unknownModelNames: [...item.unknownModelNames].sort()
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
    expect(byKey(breakdown.items)).toEqual(
      byKey(
        catalog.present
          ? [
              {
                kind: 'model',
                key: catalog.sonnet.id,
                model: catalog.sonnet,
                requests: 2,
                unknownModelNames: []
              },
              {
                kind: 'model',
                key: catalog.haiku.id,
                model: catalog.haiku,
                requests: 1,
                unknownModelNames: []
              },
              {
                kind: 'unknown',
                key: 'unknown',
                model: null,
                requests: 1,
                unknownModelNames: [madeUpModel]
              }
            ]
          : [
              {
                kind: 'unknown',
                key: 'unknown',
                model: null,
                requests: 4,
                unknownModelNames: [haiku, madeUpModel, sonnet]
              }
            ]
      )
    );
  });

  it('offers the clients and members seen as filter values and names held values without counting them', async () => {
    let values = (input: {
      field: 'member' | 'model' | 'client';
      search?: string;
      values?: string[];
    }) =>
      agentTrackingFilterValueService.listFilterValues({
        ...scope,
        range: lastWeek,
        ...input
      });

    let claudeCode = {
      value: 'claude_code',
      kind: 'client',
      member: null,
      model: null,
      client: { family: 'claude_code', name: 'Claude Code' },
      requests: 4
    };
    expect((await values({ field: 'client' })).items).toEqual([claudeCode]);
    expect((await values({ field: 'client', values: ['claude_code'] })).items).toEqual([
      { ...claudeCode, requests: null }
    ]);
    expect((await values({ field: 'client', values: ['claude-code'] })).items).toEqual([
      { ...claudeCode, value: 'claude-code', requests: null }
    ]);
    expect((await values({ field: 'model', values: ['unknown'] })).items).toEqual([
      {
        value: 'unknown',
        kind: 'unknown',
        member: null,
        model: null,
        client: null,
        requests: null
      }
    ]);
    for (let [field, value] of [
      ['model', 'con_0mhNnEqM7XQb3vXq8gD2'],
      ['model', 'claude sonnet'],
      ['member', 'anthropic/claude-sonnet-4.5'],
      ['client', 'not a client']
    ] as const) {
      expect((await values({ field, values: [value] })).items).toEqual([]);
    }

    let members = await agentTrackingSpendService.getBreakdown({
      ...scope,
      groupBy: 'member',
      range: lastWeek
    });
    let memberIds = members.items.filter(item => item.member).map(item => item.key);
    let unmatchedId = members.items.find(item => item.member?.email == unmatchedEmail)!.key;

    let offered = await values({ field: 'member' });
    expect(offered.items.map(item => item.value).sort()).toEqual(
      [...memberIds, 'unknown'].sort()
    );
    expect(offered.items.at(-1)).toMatchObject({ value: 'unknown', kind: 'unknown' });

    let searched = await values({ field: 'member', search: unmatchedEmail });
    expect(searched.items.map(item => item.value)).toEqual([unmatchedId]);
    expect(searched.items[0]).toMatchObject({
      kind: 'member',
      member: { email: unmatchedEmail }
    });
  });

  it('lists the members who sent usage, newest first, matched to Metorial or not', async () => {
    let { list, truncated } = await agentTrackingMemberService.listMembers({
      ...scope,
      page: { limit: 10 }
    });

    expect(truncated).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(list.items[0]).toMatchObject({
      email: unmatchedEmail,
      matched: false,
      consumer: null,
      sessions: 1
    });
    expect(list.items[1]).toMatchObject({
      email: matchedEmail,
      matched: true,
      consumer: { email: matchedEmail },
      sessions: 1
    });
    for (let member of list.items) expect(member.lastSeenAt).toBeInstanceOf(Date);
  });

  it('gives the sessions and cost of a member in a range, as its sessions add up', async () => {
    let seen = await agentTrackingMemberService.listMembers({ ...scope, page: { limit: 10 } });
    let matched = seen.list.items.find(member => member.email == matchedEmail)!;
    let paginator = agentTrackingSessionService.listSessions({
      ...scope,
      memberIds: [matched.id],
      range: lastWeek
    });
    let sessions: Awaited<ReturnType<typeof paginator.run>>['items'] = [];
    let after: string | undefined;
    do {
      let page = await paginator.run({ limit: 50, ...(after ? { after } : {}) });
      sessions.push(...page.items);
      after = page.pagination.hasNextPage ? page.items.at(-1)!.id : undefined;
    } while (after);

    let { list } = await agentTrackingMemberService.listMembers({
      ...scope,
      page: { limit: 10 },
      range: lastWeek,
      memberIds: [matched.id]
    });

    expect(list.items.map(member => member.id)).toEqual([matched.id]);
    let sessionMicros = sessions.map(session => session.cost.totalMicros);
    expect(sessionMicros).not.toContain(null);
    let sum = (sessionMicros as number[]).reduce((total, micros) => total + micros, 0);

    expect(list.items[0]).toMatchObject({ sessions: sessions.length });
    // Each session is rounded to micros on its own, the member total once.
    expect(Math.abs(list.items[0]!.cost.totalMicros! - sum)).toBeLessThanOrEqual(
      sessions.length
    );
  });

  it('reports usage and cost as detected once usage arrived', async () => {
    let status = await agentTrackingSetupStatusService.getSetupStatus(scope);

    expect(status.lastReceivedAt).toBeInstanceOf(Date);
    expect(status.options).toMatchObject({
      usageAndCost: 'detected',
      keepLocalHistory: 'undetectable',
      repository: 'not_detected'
    });
  });
});

describe('module-agent-tracking-query spend over several days', () => {
  let org = useOrganization();

  let today = Math.floor(Date.now() / dayMs) * dayMs;
  let days = { earlier: today - 2 * dayMs, later: today - dayMs };
  let noon = (day: number, minutes = 0) =>
    new Date(day + 12 * 60 * minuteMs + minutes * minuteMs);

  let both = uniqueEmail('agent-tracking');
  let once = uniqueEmail('agent-tracking');
  let sessionIds = {
    earlier: uniqueId('session'),
    later: uniqueId('session'),
    other: uniqueId('session')
  };
  let requests = [
    claudeRequest({
      sessionId: sessionIds.earlier,
      email: both,
      at: noon(days.earlier),
      model: madeUpModel
    }),
    claudeRequest({ sessionId: sessionIds.later, email: both, at: noon(days.later) }),
    claudeRequest({ sessionId: sessionIds.later, email: both, at: noon(days.later, 1) }),
    small({
      sessionId: sessionIds.other,
      email: once,
      at: noon(days.later, 30),
      model: haiku,
      inputTokens: 500,
      outputTokens: 50,
      costUsd: 0.002
    })
  ];

  let range = { from: new Date(days.later), to: new Date(today), timeZone: 'UTC' };

  let scope: Scope;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;

  beforeAll(async () => {
    await ingestFirstUsage(org, requests);

    scope = await readScope(org);
    catalog = await loadCatalog(org.ids);
  }, 240_000);

  it('counts a member active on two days on each of them and once in the range', async () => {
    let timeline = await agentTrackingSpendService.getTimeline({
      ...scope,
      range: { from: new Date(days.earlier), to: new Date(today), timeZone: 'UTC' }
    });

    expect(timeline.items.map(item => [item.date, item.requests, item.counts])).toEqual([
      [isoDate(days.earlier), 1, { sessions: 1, members: 1 }],
      [isoDate(days.later), 3, { sessions: 2, members: 2 }]
    ]);
    expect(timeline.counts).toEqual({ sessions: 3, members: 2, capped: false });
  });

  it('applies model and client filters to the range, the period before, the breakdown and the sessions', async () => {
    type Figures = [requests: number, cost: number, output: number];
    let none: Figures = [0, 0, 0];
    let cases: {
      filters: AgentTrackingSpendFilters;
      current: Figures;
      previous: Figures;
      members: Record<string, number>;
      sessions: number[];
    }[] = catalog.present
      ? [
          {
            filters: { modelIds: [catalog.haiku.id] },
            current: [1, 2000, 50],
            previous: none,
            members: { [once]: 1 },
            sessions: [1]
          },
          {
            filters: { modelIds: ['unknown'] },
            current: none,
            previous: [1, 12500, 200],
            members: {},
            sessions: []
          },
          {
            filters: { clientFamilies: ['claude_code'], modelIds: [catalog.sonnet.id] },
            current: [2, 25000, 400],
            previous: none,
            members: { [both]: 2 },
            sessions: [2]
          },
          {
            filters: { modelIds: ['unknown', catalog.sonnet.id] },
            current: [2, 25000, 400],
            previous: [1, 12500, 200],
            members: { [both]: 2 },
            sessions: [2]
          }
        ]
      : [
          {
            filters: { modelIds: ['unknown'] },
            current: [3, 27000, 450],
            previous: [1, 12500, 200],
            members: { [both]: 2, [once]: 1 },
            sessions: [1, 2]
          },
          {
            filters: { clientFamilies: ['claude_code'], modelIds: ['no-such-model'] },
            current: none,
            previous: none,
            members: {},
            sessions: []
          }
        ];

    for (let expected of cases) {
      let { filters } = expected;

      let timeline = await agentTrackingSpendService.getTimeline({ ...scope, range, filters });
      expect(timeline.previous.range).toMatchObject({
        from: new Date(days.earlier),
        to: range.from
      });
      for (let [presented, figures] of [
        [timeline.total, expected.current],
        [timeline.previous.total, expected.previous]
      ] as const) {
        expect([
          presented.requests,
          presented.cost.totalMicros,
          presented.tokens.output
        ]).toEqual(figures);
      }

      let breakdown = await agentTrackingSpendService.getBreakdown({
        ...scope,
        range,
        groupBy: 'member',
        filters
      });
      expect(
        Object.fromEntries(
          breakdown.items.map(item => [item.member?.email ?? 'unknown', item.requests])
        )
      ).toEqual(expected.members);

      let listed = await sessions(scope, { ...filters, orderBy: 'cost', range });
      expect(listed.map(session => session.requests).sort()).toEqual(expected.sessions);
    }
  });

  it('finds nothing for a client that sent nothing, in the range or the period before', async () => {
    let filters = { clientFamilies: ['cursor'] };

    let timeline = await agentTrackingSpendService.getTimeline({ ...scope, range, filters });
    expect(timeline.total.requests).toBe(0);
    expect(timeline.previous.total.requests).toBe(0);
    expect(timeline.counts).toEqual({ sessions: 0, members: 0, capped: false });

    let unfiltered = await agentTrackingSpendService.getTimeline({ ...scope, range });
    expect(unfiltered.total.requests).toBe(3);
    expect(unfiltered.previous.total.requests).toBe(1);

    let breakdown = await agentTrackingSpendService.getBreakdown({
      ...scope,
      range,
      groupBy: 'model',
      filters
    });
    expect(breakdown.items).toEqual([]);
    expect(await sessions(scope, { ...filters, range })).toEqual([]);
  });
});
