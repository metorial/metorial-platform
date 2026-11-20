import { notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentTrackingFilterValueService } from '../src/services/agentTrackingFilterValue';
import { agentTrackingMemberService } from '../src/services/agentTrackingMember';
import { sessionUsageRange } from '../src/lib/sessions';
import { agentTrackingSessionService } from '../src/services/agentTrackingSession';
import { agentTrackingSetupStatusService } from '../src/services/agentTrackingSetupStatus';
import { cache, callsTo, consumers, remoteMember, resetMocks, rpc, scope } from './_mocks';

let remoteSession = (overrides: Record<string, unknown> = {}) => ({
  object: 'agent_tracking#session',
  sessionKey: 'c0ffee',
  projectId: 'atpr_1',
  instanceId: 'atin_service',
  state: 'ended',
  client: { family: 'claude-code', surface: 'cli', version: '2.1.317' },
  observed: { userId: 'aten_ada', deviceId: 'aten_device', agentId: null },
  summary: {
    requests: 3,
    tokens: { inputUncached: 10, cacheRead: 20, cacheWrite: 5, output: 7, reasoning: 0 },
    costReported: [{ unit: 'usd', basis: 'client_estimate', amount: '0.42' }],
    costComputedUsd: '0.4',
    costContractUsd: null,
    costUsd: '0.42',
    models: [
      {
        modelId: 'claude-sonnet-4-5',
        rawIds: ['claude-sonnet-4-5-20250929'],
        billing: { mode: 'included' }
      },
      {
        modelId: 'claude-sonnet-4-5',
        rawIds: ['claude-sonnet-4-5-20250929'],
        billing: { mode: 'overage' }
      },
      { modelId: null, rawIds: ['claude-experimental-x'], billing: { mode: 'unknown' } }
    ]
  },
  summaryStale: false,
  startedAt: new Date('2026-11-17T09:00:00Z'),
  lastActivityAt: new Date('2026-11-17T10:00:00Z'),
  endedAt: new Date('2026-11-17T10:05:00Z'),
  ...overrides
});

describe('agentTrackingSessionService', () => {
  beforeEach(() => {
    resetMocks();
    rpc.handlers['entity:list'] = () => ({ items: [remoteMember()], pagination: {} });
    rpc.handlers['knowledge:models:get'] = ({ modelId }) => ({
      id: modelId,
      name: 'Claude Sonnet 4.5'
    });
  });

  it('filters by member and model, with unknown meaning no member', async () => {
    rpc.handlers['session:list'] = () => ({
      object: 'list',
      items: [
        remoteSession(),
        remoteSession({ sessionKey: 'beef', observed: { userId: null } })
      ],
      pagination: {
        hasMore: true,
        nextCursor: 'n',
        hasMoreAfter: true,
        hasMoreBefore: false,
        after: 'next'
      }
    });

    let paginator = await agentTrackingSessionService.listSessions({
      ...scope,
      memberIds: ['unknown', 'aten_ada', 'aten_ada'],
      modelIds: ['claude-sonnet-4-5']
    });
    let page = await paginator.run({ limit: 2 });

    expect(callsTo('session:list')[0]!.input).toEqual({
      organizationId: 'org_1',
      instanceIds: ['atin_service'],
      userIds: ['aten_ada', null],
      modelIds: ['claude-sonnet-4-5'],
      limit: 2,
      order: 'desc'
    });
    expect(page.pagination.hasNextPage).toBe(true);

    let [first, second] = page.items;
    expect(first).toMatchObject({
      id: 'atse_c0ffee',
      state: 'ended',
      member: { id: 'aten_ada', email: 'ada@example.com' },
      client: {
        family: 'claude_code',
        name: 'Claude Code',
        surface: 'cli',
        version: '2.1.317'
      },
      models: [{ id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' }],
      unknownModelNames: ['claude-experimental-x'],
      billingModes: ['included', 'overage', 'unknown'],
      cost: { total: '0.42', reportedByClient: '0.42', listPrice: '0.4', isEstimate: true },
      tokens: { total: 42 },
      requests: 3,
      summaryPending: false
    });
    expect(first).not.toHaveProperty('sessionKey');
    expect(second!.member).toBeNull();
    expect(callsTo('knowledge:models:get')).toHaveLength(1);
  });

  it('selects sessions with a model outside the catalog by unknown', async () => {
    rpc.handlers['session:list'] = () => ({
      object: 'list',
      items: [],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });

    let paginator = await agentTrackingSessionService.listSessions({
      ...scope,
      modelIds: ['unknown', 'claude-sonnet-4-5']
    });
    await paginator.run({ limit: 2 });

    expect(callsTo('session:list')[0]!.input.modelIds).toEqual(['claude-sonnet-4-5', null]);
  });

  it('passes the page anchor through to the service', async () => {
    rpc.handlers['session:list'] = () => ({
      items: [],
      pagination: { hasMoreAfter: false, hasMoreBefore: true, before: 'prev' }
    });

    let paginator = await agentTrackingSessionService.listSessions(scope);
    let first = await paginator.run({});
    expect(first.pagination.hasPreviousPage).toBe(true);

    await (
      await agentTrackingSessionService.listSessions(scope)
    ).run({ before: first.pagination.before });
    expect(callsTo('session:list')[1]!.input).toMatchObject({ before: 'prev' });
  });
});

describe('session list order and range', () => {
  beforeEach(() => {
    resetMocks();
    rpc.handlers['entity:list'] = () => ({ items: [], pagination: {} });
    rpc.handlers['session:list'] = () => ({
      items: [],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });
  });

  it('asks the service for cost order and bounds last activity by the range', async () => {
    let from = new Date('2026-11-01T00:00:00Z');
    let to = new Date('2026-11-08T00:00:00Z');

    await (
      await agentTrackingSessionService.listSessions({
        ...scope,
        orderBy: 'cost',
        range: { from, to }
      })
    ).run({ limit: 4 });

    expect(callsTo('session:list')[0]!.input).toEqual({
      organizationId: 'org_1',
      instanceIds: ['atin_service'],
      lastActivityFrom: from,
      lastActivityTo: to,
      limit: 4,
      order: 'desc',
      orderBy: 'cost'
    });
  });

  it('passes the client filter on as the service client family', async () => {
    await (
      await agentTrackingSessionService.listSessions({
        ...scope,
        clientFamilies: ['claude_code', 'cursor', 'claude_code']
      })
    ).run({});

    expect(callsTo('session:list')[0]!.input.clientFamilies).toEqual([
      'claude-code',
      'cursor'
    ]);
  });

  it('resolves a preset in the time zone and leaves the default order and range out', async () => {
    await (
      await agentTrackingSessionService.listSessions({
        ...scope,
        orderBy: 'last_activity',
        range: { preset: 'today', timeZone: 'Asia/Tokyo' }
      })
    ).run({});
    await (
      await agentTrackingSessionService.listSessions({
        ...scope,
        range: { timeZone: 'Asia/Tokyo' }
      })
    ).run({});

    let [preset, none] = callsTo('session:list').map(call => call.input);
    expect(preset).not.toHaveProperty('orderBy');
    expect(
      preset.lastActivityTo.getTime() - preset.lastActivityFrom.getTime()
    ).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(preset.lastActivityFrom.getUTCHours()).toBe(15);
    expect(none).not.toHaveProperty('lastActivityFrom');
    expect(none).not.toHaveProperty('orderBy');
  });

  it('keeps pages of different orders and ranges apart in the cache', async () => {
    let list = async (d: Record<string, unknown>) =>
      await (await agentTrackingSessionService.listSessions({ ...scope, ...d })).run({});

    await list({});
    await list({ orderBy: 'cost' });
    await list({ range: { preset: 'last_7_days' } });
    await list({ range: { preset: 'last_7_days' } });

    expect(callsTo('session:list')).toHaveLength(3);
  });

  it('rejects an incomplete range', async () => {
    expect(() =>
      agentTrackingSessionService.listSessions({
        ...scope,
        range: { from: new Date('2026-11-01T00:00:00Z') }
      })
    ).toThrow('Pass both from and to.');
  });
});

describe('one session', () => {
  let usageRow = (model: string | null, cost: number, requests: number) => ({
    model,
    'cost.usd': cost,
    'cost.list': cost,
    'cost.reported': [{ unit: 'usd', basis: 'billed', amount: cost / 2 }],
    cost_usd_included: 0,
    cost_usd_overage: 0,
    cost_usd_api: cost,
    cost_usd_unknown: 0,
    requests,
    requests_without_cost: 0,
    requests_without_list_price: 0,
    tokens: {
      inputUncached: 10,
      cacheRead: 20,
      cacheWrite: 5,
      output: 7,
      reasoning: 0,
      total: 42
    },
    share: 0.5
  });

  beforeEach(() => {
    resetMocks();
    rpc.handlers['entity:list'] = () => ({ items: [remoteMember()], pagination: {} });
    rpc.handlers['knowledge:models:get'] = ({ modelId }) => ({
      id: modelId,
      name: 'Claude Sonnet 4.5'
    });
    rpc.handlers['session:get'] = () => remoteSession();
    rpc.handlers['query:run'] = () => ({
      rows: [
        usageRow('claude-sonnet-4-5', 0.3, 2),
        usageRow(null, 0.12, 1),
        { ...usageRow('claude-idle', 0, 0), tokens: {} }
      ],
      totals: usageRow(null, 0.42, 3),
      labels: { model: { 'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5' } } }
    });
  });

  it('returns the list row with requests, tokens and cost per model, in one query', async () => {
    let session = await agentTrackingSessionService.getSession({
      ...scope,
      sessionId: 'atse_c0ffee'
    });

    expect(callsTo('session:get')[0]!.input).toEqual({
      organizationId: 'org_1',
      sessionKey: 'c0ffee'
    });

    let [query] = callsTo('query:run');
    expect(callsTo('query:run')).toHaveLength(1);
    expect(query!.input).toMatchObject({
      organizationId: 'org_1',
      scope: { instanceIds: ['atin_service'] },
      query: {
        dataset: 'usage',
        where: { field: 'session', op: 'eq', value: 'c0ffee' },
        dimensions: ['model'],
        range: { from: '2026-11-17T08:45:00.000Z', to: '2026-11-17T10:15:00.000Z' }
      }
    });

    expect(session).toMatchObject({
      id: 'atse_c0ffee',
      member: { id: 'aten_ada' },
      cost: { total: '0.42' },
      requests: 3
    });
    expect(session.usageByModel).toHaveLength(2);
    expect(session.usageByModel[0]).toMatchObject({
      kind: 'model',
      key: 'claude-sonnet-4-5',
      model: { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      unknownModelNames: [],
      requests: 2,
      share: 0.5,
      cost: { total: '0.3', billed: '0.15', estimated: '0.15', isEstimate: true },
      tokens: { input: 10, cacheRead: 20, cacheWrite: 5, output: 7, total: 42 }
    });
    expect(session.usageByModel[1]).toMatchObject({
      kind: 'unknown',
      key: 'unknown',
      model: null,
      unknownModelNames: ['claude-experimental-x'],
      requests: 1
    });
  });

  it('answers not found for a session of another instance, an unknown key or a foreign id', async () => {
    rpc.handlers['session:get'] = () => remoteSession({ instanceId: 'atin_other' });
    await expect(
      agentTrackingSessionService.getSession({ ...scope, sessionId: 'atse_c0ffee' })
    ).rejects.toMatchObject({ data: { status: 404 } });
    expect(callsTo('query:run')).toHaveLength(0);

    rpc.handlers['session:get'] = () => {
      throw new ServiceError(notFoundError('session', 'c0ffee'));
    };
    await expect(
      agentTrackingSessionService.getSession({ ...scope, sessionId: 'atse_beef' })
    ).rejects.toMatchObject({ data: { status: 404, code: 'not_found' } });

    await expect(
      agentTrackingSessionService.getSession({ ...scope, sessionId: 'ses_c0ffee' })
    ).rejects.toMatchObject({ data: { status: 404 } });
    expect(callsTo('session:get')).toHaveLength(2);
  });

  it('keeps the usage range within the longest range the engine accepts', () => {
    let range = sessionUsageRange({
      startedAt: new Date('2024-01-01T00:00:00Z'),
      lastActivityAt: new Date('2026-01-01T00:00:00Z')
    });

    expect((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)).toBe(400);
  });
});

describe('session paging by item id', () => {
  beforeEach(() => {
    resetMocks();
    rpc.handlers['entity:list'] = () => ({ items: [], pagination: {} });
    rpc.handlers['session:list'] = () => ({
      items: [],
      pagination: {
        hasMoreAfter: true,
        hasMoreBefore: true,
        after: 'pos_after',
        before: 'pos_before'
      }
    });
  });

  it('turns an item id into the session key the service anchors on', async () => {
    let paginator = await agentTrackingSessionService.listSessions(scope);

    await paginator.run({ after: 'atse_c0ffee', limit: 5 });
    await paginator.run({ before: 'atse_beef', limit: 5 });

    expect(callsTo('session:list')[0]!.input).toMatchObject({ after: 'c0ffee' });
    expect(callsTo('session:list')[1]!.input).toMatchObject({ before: 'beef' });
    expect(callsTo('session:list')[1]!.input).not.toHaveProperty('after');
  });

  it('passes the service position cursors through unchanged', async () => {
    let paginator = await agentTrackingSessionService.listSessions(scope);
    let first = await paginator.run({ limit: 5 });

    await paginator.run({ after: first.pagination.after, limit: 5 });
    await paginator.run({ before: first.pagination.before, limit: 5 });

    expect(callsTo('session:list')[1]!.input).toMatchObject({ after: 'pos_after' });
    expect(callsTo('session:list')[2]!.input).toMatchObject({ before: 'pos_before' });
  });
});

describe('agentTrackingFilterValueService', () => {
  beforeEach(() => resetMocks());

  it('lists members seen in telemetry and offers Unknown Member last', async () => {
    rpc.handlers['query:values'] = () => ({
      values: [
        { value: 'aten_ada', label: { name: 'Ada' }, count: 12 },
        { value: 'aten_eve', label: { name: 'Eve' }, count: 3 }
      ],
      truncated: false
    });
    rpc.handlers['entity:list'] = () => ({
      items: [
        remoteMember(),
        remoteMember({ id: 'aten_eve', source: null, ref: null, name: 'Eve' })
      ],
      pagination: {}
    });

    let result = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'member',
      range: { preset: 'last_7_days' }
    });

    expect(callsTo('query:values')[0]!.input).toMatchObject({
      dataset: 'usage',
      field: 'user',
      scope: { instanceIds: ['atin_service'] },
      limit: 100
    });
    expect(result.items.map(item => [item.kind, item.value, item.requests])).toEqual([
      ['member', 'aten_ada', 12],
      ['member', 'aten_eve', 3],
      ['unknown', 'unknown', null]
    ]);
  });

  it('does not offer the unknown option to a search it does not match', async () => {
    rpc.handlers['query:values'] = () => ({ values: [], truncated: false });

    let members = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'member',
      search: 'ada',
      range: {}
    });
    let models = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'model',
      search: 'sonnet',
      range: {}
    });

    expect(members.items).toEqual([]);
    expect(models.items).toEqual([]);
  });

  it('offers Unknown Model last, so usage outside the model catalog can be selected', async () => {
    rpc.handlers['query:values'] = () => ({
      values: [
        { value: 'claude-sonnet-4-5', label: { name: 'Claude Sonnet 4.5' }, count: 4 },
        { value: null, label: null, count: 2 }
      ],
      truncated: false
    });

    let models = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'model',
      range: {}
    });
    let searched = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'model',
      search: 'unknown',
      range: {}
    });

    expect(models.items).toEqual([
      {
        value: 'claude-sonnet-4-5',
        kind: 'model',
        member: null,
        model: { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        client: null,
        requests: 4
      },
      {
        value: 'unknown',
        kind: 'unknown',
        member: null,
        model: null,
        client: null,
        requests: null
      }
    ]);
    expect(searched.items.at(-1)).toMatchObject({ value: 'unknown', kind: 'unknown' });
  });
});

describe('agentTrackingFilterValueService for clients and held values', () => {
  beforeEach(() => resetMocks());

  it('lists clients by their Metorial family and offers no unknown option', async () => {
    rpc.handlers['query:values'] = () => ({
      values: [
        { value: 'claude-code', label: null, count: 9 },
        { value: 'cursor', label: null, count: 2 }
      ],
      truncated: false
    });

    let clients = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'client',
      range: {}
    });

    expect(callsTo('query:values')[0]!.input).toMatchObject({
      dataset: 'usage',
      field: 'client.family'
    });
    expect(clients.items).toEqual([
      {
        value: 'claude_code',
        kind: 'client',
        member: null,
        model: null,
        client: { family: 'claude_code', name: 'Claude Code' },
        requests: 9
      },
      {
        value: 'cursor',
        kind: 'client',
        member: null,
        model: null,
        client: { family: 'cursor', name: null },
        requests: 2
      }
    ]);
  });

  it('describes held values without reading usage', async () => {
    rpc.handlers['knowledge:models:get'] = ({ modelId }) => ({ name: `Named ${modelId}` });
    rpc.handlers['entity:list'] = () => ({ items: [remoteMember()], pagination: {} });

    let models = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'model',
      values: ['unknown', 'anthropic/claude-sonnet-4.5'],
      range: {}
    });
    let clients = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'client',
      values: ['claude_code', 'unknown'],
      range: {}
    });
    let members = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'member',
      values: ['aten_ada'],
      range: {}
    });

    expect(callsTo('query:values')).toHaveLength(0);
    expect(callsTo('query:run')).toHaveLength(0);
    expect(models.items.map(item => [item.kind, item.value, item.model?.name])).toEqual([
      ['model', 'anthropic/claude-sonnet-4.5', 'Named anthropic/claude-sonnet-4.5'],
      ['unknown', 'unknown', undefined]
    ]);
    expect(clients.items.map(item => [item.kind, item.value, item.client?.name])).toEqual([
      ['client', 'claude_code', 'Claude Code'],
      ['client', 'unknown', null]
    ]);
    expect(members.items).toEqual([
      expect.objectContaining({ kind: 'member', value: 'aten_ada', requests: null })
    ]);
    expect(members.items[0]!.member).toMatchObject({ id: 'aten_ada' });
  });

  it('names either spelling of a client family and skips values that cannot be ids', async () => {
    let clients = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'client',
      values: ['claude-code', 'claude_code', 'not a family'],
      range: {}
    });
    let skipped = await Promise.all(
      [
        { field: 'model' as const, values: ['claude sonnet', 'x'.repeat(300)] },
        { field: 'member' as const, values: ['con_ada', 'anthropic/claude-sonnet-4.5'] }
      ].map(d =>
        agentTrackingFilterValueService.listFilterValues({ ...scope, ...d, range: {} })
      )
    );

    expect(clients.items.map(item => [item.value, item.client])).toEqual([
      ['claude-code', { family: 'claude_code', name: 'Claude Code' }],
      ['claude_code', { family: 'claude_code', name: 'Claude Code' }]
    ]);
    expect(skipped.map(result => result.items)).toEqual([[], []]);
    expect(rpc.calls.filter(call => call.path != 'instance:get')).toEqual([]);
    expect(cache.store.size).toBe(0);
  });

  it('caches held values a lookup cannot name, so they are not asked for again', async () => {
    rpc.handlers['knowledge:models:get'] = () => {
      throw new ServiceError(notFoundError('knowledge_model', 'anthropic/claude-x'));
    };
    rpc.handlers['entity:list'] = () => ({ items: [], pagination: {} });

    for (let attempt = 0; attempt < 2; attempt++) {
      await agentTrackingFilterValueService.listFilterValues({
        ...scope,
        field: 'model',
        values: ['anthropic/claude-x'],
        range: {}
      });
      await agentTrackingFilterValueService.listFilterValues({
        ...scope,
        field: 'member',
        values: ['aten_gone'],
        range: {}
      });
    }

    expect(callsTo('knowledge:models:get')).toHaveLength(1);
    expect(callsTo('entity:list')).toHaveLength(1);
  });

  it('refuses a search together with held values', async () => {
    await expect(
      agentTrackingFilterValueService.listFilterValues({
        ...scope,
        field: 'model',
        search: 'sonnet',
        values: ['claude-sonnet-4-5'],
        range: {}
      })
    ).rejects.toMatchObject({ data: { status: 400 } });
  });
});

describe('agentTrackingMemberService', () => {
  let seenRows = ['aten_ada', 'aten_bob', 'aten_cy'].map((user, index) => ({
    user,
    sessions: 3 - index,
    last_activity: new Date(Date.parse('2026-11-18T10:00:00Z') - index * 60_000).toISOString()
  }));

  beforeEach(() => {
    resetMocks();
    rpc.handlers['query:run'] = () => ({ rows: seenRows, meta: { truncated: false } });
    rpc.handlers['entity:list'] = ({ ids }) => ({
      items: [
        remoteMember(),
        remoteMember({ id: 'aten_bob', source: null, ref: null, name: null }),
        remoteMember({ id: 'aten_cy', source: null, ref: null, name: null })
      ].filter(member => ids.includes(member.id)),
      pagination: { has_more_after: false, has_more_before: false }
    });
    consumers.findMany.mockImplementation(async () => [
      { id: 'con_ada', name: 'Ada Lovelace', email: 'ada@example.com', instanceConsumers: [] }
    ]);
  });

  it('lists the members seen in this instance from its sessions, latest first', async () => {
    let result = await agentTrackingMemberService.listMembers({ ...scope, page: {} });

    expect(callsTo('query:run')[0]!.input).toMatchObject({
      scope: { instanceIds: ['atin_service'] },
      query: {
        dataset: 'sessions',
        dimensions: [{ field: 'user', missing: 'exclude' }],
        measures: ['sessions', 'last_activity'],
        orderBy: [{ by: 'last_activity', direction: 'desc' }],
        limit: 1000
      }
    });
    expect(result.truncated).toBe(false);
    expect(
      result.list.items.map(member => [member.id, member.matched, member.sessions])
    ).toEqual([
      ['aten_ada', true, 3],
      ['aten_bob', false, 2],
      ['aten_cy', false, 1]
    ]);
    expect(result.list.items[0]!.lastSeenAt).toEqual(new Date('2026-11-18T10:00:00Z'));
    expect(result.list.items[0]!.consumer).toEqual({
      id: null,
      name: 'Ada Lovelace',
      email: 'ada@example.com'
    });
  });

  it('pages forward and back by item id, looking up only the page', async () => {
    let first = await agentTrackingMemberService.listMembers({ ...scope, page: { limit: 2 } });
    expect(first.list.items.map(member => member.id)).toEqual(['aten_ada', 'aten_bob']);
    expect(first.list.pagination.hasNextPage).toBe(true);
    expect(callsTo('entity:list').at(-1)!.input.ids).toEqual(['aten_ada', 'aten_bob']);

    let second = await agentTrackingMemberService.listMembers({
      ...scope,
      page: { limit: 2, after: 'aten_bob' }
    });
    expect(second.list.items.map(member => member.id)).toEqual(['aten_cy']);
    expect(second.list.pagination).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: true
    });

    let back = await agentTrackingMemberService.listMembers({
      ...scope,
      page: { limit: 2, before: 'aten_cy' }
    });
    expect(back.list.items.map(member => member.id)).toEqual(['aten_ada', 'aten_bob']);

    expect(callsTo('query:run')).toHaveLength(1);
  });

  it('says when the list is capped', async () => {
    rpc.handlers['query:run'] = () => ({ rows: seenRows, meta: { truncated: true } });

    expect(
      (await agentTrackingMemberService.listMembers({ ...scope, page: {} })).truncated
    ).toBe(true);
  });

  it('rejects an anchor that is not in the list', async () => {
    await expect(
      agentTrackingMemberService.listMembers({ ...scope, page: { after: 'aten_gone' } })
    ).rejects.toMatchObject({ data: { status: 400 } });
  });
});

describe('merged members', () => {
  beforeEach(() => resetMocks());

  it('shows a merged member with the details of the member it was merged into', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [{ user: 'aten_old', sessions: 1, last_activity: new Date().toISOString() }],
      meta: { truncated: false }
    });
    rpc.handlers['entity:list'] = ({ ids, statuses }) => {
      expect(statuses).toContain('merged');
      return {
        items: [
          remoteMember({ id: 'aten_old', status: 'merged', mergedIntoId: 'aten_ada' }),
          remoteMember()
        ].filter(member => ids.includes(member.id)),
        pagination: {}
      };
    };
    consumers.findMany.mockImplementation(async () => [
      { id: 'con_ada', name: 'Ada Lovelace', email: 'ada@example.com', instanceConsumers: [] }
    ]);

    let result = await agentTrackingMemberService.listMembers({ ...scope, page: {} });

    expect(callsTo('entity:list').map(call => call.input.ids)).toEqual([
      ['aten_old'],
      ['aten_ada']
    ]);
    expect(result.list.items[0]).toMatchObject({
      id: 'aten_old',
      matched: true,
      name: 'Ada Lovelace',
      email: 'ada@example.com'
    });
  });
});

describe('agentTrackingSetupStatusService', () => {
  beforeEach(() => resetMocks());

  let coverage = (overrides: Record<string, unknown> = {}) => ({
    sessions: { total: 4, withoutUsage: 1, withoutRepo: 4 },
    sources: [
      {
        family: 'claude-code',
        lastSeen: { hook: null },
        lastSeenAt: new Date('2026-11-18T09:00:00Z')
      }
    ],
    ...overrides
  });

  let evidence = (d: { usage?: number; repo?: number; details?: number }) => {
    rpc.handlers['query:run'] = ({ query }) =>
      query.dataset == 'sessions'
        ? {
            rows: [{ sessions_with_usage: d.usage ?? 0, sessions_with_repo: d.repo ?? 0 }]
          }
        : { rows: [{ tool_calls_with_details: d.details ?? 0 }] };
  };

  let claudeCode = { field: 'client.family', op: 'eq', value: 'claude-code' };

  it('reads each option from the evidence and keeps local history undetectable', async () => {
    rpc.handlers['ingestSource:list'] = () => ({
      items: [{ lastUsedAt: new Date('2026-11-18T09:30:00Z') }, { lastUsedAt: null }]
    });
    rpc.handlers['coverage:get'] = () => coverage();
    evidence({ usage: 3, details: 1 });

    let status = await agentTrackingSetupStatusService.getSetupStatus(scope);

    expect(status.lastReceivedAt).toEqual(new Date('2026-11-18T09:30:00Z'));
    expect(status.options).toEqual({
      usageAndCost: 'detected',
      keepLocalHistory: 'undetectable',
      repository: 'not_detected',
      toolDetails: 'detected',
      hooks: 'not_detected'
    });

    let queries = callsTo('query:run').map(call => call.input.query);
    expect(queries.find(query => query.dataset == 'sessions')).toMatchObject({
      where: claudeCode,
      measures: [
        {
          fn: 'count',
          where: { field: 'coverage.hasUsage', op: 'eq', value: true },
          as: 'sessions_with_usage'
        },
        {
          fn: 'count',
          where: { field: 'coverage.hasRepo', op: 'eq', value: true },
          as: 'sessions_with_repo'
        }
      ]
    });
    expect(queries.find(query => query.dataset == 'tool_calls')).toMatchObject({
      where: {
        and: [
          claudeCode,
          { field: 'source.channel', op: 'eq', value: 'otlp.logs' },
          {
            or: [
              { field: 'content.roles', op: 'eq', value: 'tool_input' },
              { field: 'mcp.server', op: 'notNull' }
            ]
          }
        ]
      },
      measures: [{ fn: 'count', as: 'tool_calls_with_details' }]
    });
  });

  it('shows nothing detected and no arrival before any data', async () => {
    rpc.handlers['ingestSource:list'] = () => ({ items: [] });
    rpc.handlers['coverage:get'] = () =>
      coverage({ sessions: { total: 0, withoutUsage: 0, withoutRepo: 0 }, sources: [] });
    evidence({});

    let status = await agentTrackingSetupStatusService.getSetupStatus(scope);

    expect(status.lastReceivedAt).toBeNull();
    expect(Object.values(status.options).filter(value => value == 'detected')).toEqual([]);
  });

  it('detects hooks from recent hook records of Claude Code only', async () => {
    rpc.handlers['ingestSource:list'] = () => ({ items: [] });
    rpc.handlers['query:run'] = () => ({ rows: [] });

    rpc.handlers['coverage:get'] = () =>
      coverage({
        sources: [{ family: 'codex', lastSeen: { hook: new Date() }, lastSeenAt: new Date() }]
      });
    let other = await agentTrackingSetupStatusService.getSetupStatus(scope);

    rpc.handlers['coverage:get'] = () =>
      coverage({
        sources: [
          { family: 'claude-code', lastSeen: { hook: new Date() }, lastSeenAt: new Date() }
        ]
      });
    let own = await agentTrackingSetupStatusService.getSetupStatus({
      ...scope,
      instance: { ...scope.instance, id: 'ins_other' }
    });

    expect(other.options.hooks).toBe('not_detected');
    expect(own.options.hooks).toBe('detected');
    expect(own.options.toolDetails).toBe('not_detected');
  });
});
