import { badRequestError, ServiceError } from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@lowerdeck/sentry', () => ({ getSentry: () => sentry }));

import { providerCallsLimit } from '../src/lib/providerCalls';
import { agentTrackingFilterValueService } from '../src/services/agentTrackingFilterValue';
import { agentTrackingSessionService } from '../src/services/agentTrackingSession';
import { agentTrackingToolService } from '../src/services/agentTrackingTool';
import {
  agentTrackingEnabled,
  callsTo,
  privacy,
  providers,
  rejection,
  remoteMember,
  remoteRepository,
  resetMocks,
  rpc,
  scope
} from './_mocks';

let now = new Date('2026-11-22T12:00:00Z');

let range = { from: new Date('2026-11-21T12:00:00Z'), to: now };

let fullScope = { ...scope } as any;

let readers = { ...scope, canReadProviders: true };

let linear = { id: 'pro_linear', name: 'Linear', instanceId: null };

let github = { id: 'pro_github', name: 'GitHub', instanceId: null };

let elsewhere = { id: 'pro_private', name: 'Private', instanceId: 'inst_other' };

let dimensionsOf = (query: any) =>
  (query.dimensions ?? []).map((dimension: any) => dimension.field ?? dimension).join(',');

let answer = (results: (query: any) => Record<string, unknown>) => {
  rpc.handlers['query:run'] = (({ query }: any) => ({
    totals: null,
    labels: {},
    meta: {},
    rows: [],
    ...results(query)
  })) as any;
};

let remoteSession = (overrides: Record<string, unknown> = {}) => ({
  object: 'agent_tracking#session',
  sessionKey: 'c0ffee',
  projectId: 'proj_1',
  instanceId: 'inst_1',
  state: 'ended',
  client: { family: 'claude-code', surface: 'cli', version: '2.1.317' },
  observed: { userId: null, deviceId: null, agentId: null },
  summary: {
    requests: 1,
    models: [],
    metorial: { providerIds: ['pro_linear', 'pro_gone'], toolKeys: [] }
  },
  summaryStale: false,
  startedAt: new Date('2026-11-17T09:00:00Z'),
  lastActivityAt: new Date('2026-11-17T10:00:00Z'),
  endedAt: null,
  ...overrides
});

beforeEach(() => {
  resetMocks();
  sentry.captureException.mockClear();
  providers.rows = [linear, github, elsewhere];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe('agent tool calls by repository, member or client', () => {
  it('refuses with not found when agent tracking is off, without asking agent tracking', async () => {
    agentTrackingEnabled.mockImplementation(async () => false);

    let error = await rejection(
      agentTrackingToolService.getProviderCalls({ ...fullScope, range, groupBy: 'repository' })
    );

    expect(error).toMatchObject({ status: 404 });
    expect(rpc.calls).toHaveLength(0);
  });

  it('refuses every split when the organization hides individuals', async () => {
    privacy.hideIndividuals = true;

    let member = await rejection(
      agentTrackingToolService.getProviderCalls({ ...fullScope, range, groupBy: 'member' })
    );
    expect(member).toMatchObject({ status: 403, code: 'agent_tracking_individuals_hidden' });
    expect(member.message).toContain('per member');

    for (let groupBy of ['repository', 'client'] as const) {
      let error = await rejection(
        agentTrackingToolService.getProviderCalls({ ...fullScope, range, groupBy })
      );
      expect(error).toMatchObject({ status: 403, code: 'agent_tracking_individuals_hidden' });
      expect(error.message).toContain('not broken down by repository or client');
    }
    expect(rpc.calls).toHaveLength(0);
  });

  it('counts only calls stamped with a provider, by repository', async () => {
    rpc.handlers['entity:list'] = () => ({ items: [remoteRepository()], pagination: {} });
    answer(() => ({
      rows: [
        { repo: 'aten_repo', tool_calls: 7, 'tool_calls.failed': 2 },
        { repo: null, tool_calls: 3, 'tool_calls.failed': 0 },
        { repo: '$other', tool_calls: 1, 'tool_calls.failed': 1 },
        { repo: 'aten_quiet', tool_calls: 0, 'tool_calls.failed': 0 }
      ],
      totals: { tool_calls: 11, 'tool_calls.failed': 3 }
    }));

    let calls = await agentTrackingToolService.getProviderCalls({
      ...fullScope,
      range,
      groupBy: 'repository'
    });

    let [query] = callsTo('query:run').map(call => call.input.query);
    expect(query).toMatchObject({
      dataset: 'tool_calls',
      where: { field: 'metorial.provider', op: 'notNull' },
      dimensions: ['repo'],
      measures: ['tool_calls', 'tool_calls.failed'],
      limit: providerCallsLimit,
      other: true,
      totals: true
    });
    expect(calls).toMatchObject({
      groupBy: 'repository',
      providerId: null,
      toolKey: null,
      total: { calls: 11, failed: 3 }
    });
    expect(calls.items).toEqual([
      {
        kind: 'repository',
        key: 'aten_repo',
        member: null,
        client: null,
        repository: expect.objectContaining({ id: 'aten_repo', owner: 'acme', name: 'api' }),
        calls: 7,
        failed: 2
      },
      {
        kind: 'unknown',
        key: 'unknown',
        member: null,
        client: null,
        repository: null,
        calls: 3,
        failed: 0
      },
      {
        kind: 'other',
        key: 'other',
        member: null,
        client: null,
        repository: null,
        calls: 1,
        failed: 1
      }
    ]);
  });

  it('counts calls stamped without a tool key unless narrowed to a tool', async () => {
    answer(() => ({ rows: [{ 'client.family': 'codex', tool_calls: 3 }] }));

    let all = await agentTrackingToolService.getProviderCalls({
      ...fullScope,
      range,
      groupBy: 'client',
      providerId: 'pro_linear'
    });

    let [query] = callsTo('query:run').map(call => call.input.query);
    expect(query.where).toEqual({ field: 'metorial.provider', op: 'eq', value: 'pro_linear' });
    expect(all).toMatchObject({ toolKey: null, total: { calls: 0 }, items: [{ calls: 3 }] });
  });

  it('narrows to one provider and one tool key', async () => {
    rpc.handlers['entity:list'] = () => ({ items: [remoteMember()], pagination: {} });
    answer(() => ({ rows: [{ user: 'aten_ada', tool_calls: 2, 'tool_calls.failed': 0 }] }));

    let calls = await agentTrackingToolService.getProviderCalls({
      ...fullScope,
      range,
      groupBy: 'member',
      providerId: 'pro_linear',
      toolKey: 'create_issue'
    });

    let [query] = callsTo('query:run').map(call => call.input.query);
    expect(query.where).toEqual({
      and: [
        { field: 'metorial.provider', op: 'eq', value: 'pro_linear' },
        { field: 'metorial.tool', op: 'eq', value: 'create_issue' }
      ]
    });
    expect(query.dimensions).toEqual(['user']);
    expect(calls).toMatchObject({ providerId: 'pro_linear', toolKey: 'create_issue' });
    expect(calls.items).toMatchObject([
      { kind: 'member', key: 'aten_ada', member: { id: 'aten_ada' }, calls: 2 }
    ]);
  });

  it('names clients by their Metorial family', async () => {
    answer(() => ({ rows: [{ 'client.family': 'claude-code', tool_calls: 4 }] }));

    let calls = await agentTrackingToolService.getProviderCalls({
      ...fullScope,
      range,
      groupBy: 'client'
    });

    expect(callsTo('query:run')[0]!.input.query.dimensions).toEqual(['client.family']);
    expect(calls.items).toMatchObject([
      { kind: 'client', key: 'claude_code', client: { family: 'claude_code' }, calls: 4 }
    ]);
  });

  it('refuses a range longer than the records are kept', async () => {
    let error = await rejection(
      agentTrackingToolService.getProviderCalls({
        ...fullScope,
        range: { from: new Date('2026-07-01T00:00:00Z'), to: now },
        groupBy: 'repository'
      })
    );

    expect(error).toMatchObject({ status: 400 });
    expect(callsTo('query:run')).toHaveLength(0);
  });
});

describe('the provider of each MCP server', () => {
  let stampedQuery = (query: any) => dimensionsOf(query) == 'mcp.server,metorial.provider';

  let usageWith = async (
    stamped: (() => Record<string, unknown>) | Record<string, unknown>,
    d: Record<string, unknown> = readers
  ) => {
    answer(query => {
      let dimensions = dimensionsOf(query);
      if (dimensions == 'mcp.server') {
        return {
          rows: ['linear', 'shared', 'private', 'unstamped'].map(name => ({
            'mcp.server': name,
            tool_calls: 1
          }))
        };
      }
      if (stampedQuery(query)) return typeof stamped == 'function' ? stamped() : stamped;

      return { rows: [] };
    });

    return await agentTrackingToolService.getMcpServerUsage({ ...(d as any), range: {} });
  };

  let stampedRows = {
    rows: [
      { 'mcp.server': 'linear', 'metorial.provider': 'pro_linear', tool_calls: 5 },
      { 'mcp.server': 'shared', 'metorial.provider': 'pro_linear', tool_calls: 3 },
      { 'mcp.server': 'shared', 'metorial.provider': 'pro_github', tool_calls: 1 },
      { 'mcp.server': 'private', 'metorial.provider': 'pro_private', tool_calls: 1 }
    ]
  };

  it('names one provider per server, none for a server with two or one Metorial cannot show', async () => {
    let usage = await usageWith(stampedRows);

    expect(usage.items.map(item => [item.name, item.provider])).toEqual([
      ['linear', { id: 'pro_linear', name: 'Linear' }],
      ['shared', null],
      ['private', null],
      ['unstamped', null]
    ]);
    expect(providers.getManyProvidersByIds).toHaveBeenCalledTimes(1);
    expect(providers.getManyProvidersByIds.mock.calls[0]![0]).toMatchObject({
      instance: { id: 'inst_1' },
      ids: ['pro_linear', 'pro_private']
    });
  });

  it('names none when the stamped calls were cut off', async () => {
    let usage = await usageWith({ ...stampedRows, meta: { truncated: true } });

    expect(usage.items.every(item => item.provider === null)).toBe(true);
    expect(providers.getManyProvidersByIds).not.toHaveBeenCalled();
  });

  it('withholds providers without provider read access, without asking for them', async () => {
    let usage = await usageWith(stampedRows, scope);

    expect(usage.items).toHaveLength(4);
    expect(usage.items.every(item => item.provider === null)).toBe(true);
    expect(
      callsTo('query:run')
        .map(call => call.input.query)
        .some(stampedQuery)
    ).toBe(false);
    expect(providers.getManyProvidersByIds).not.toHaveBeenCalled();
  });

  it('lists the servers without providers when the provider query is refused', async () => {
    let usage = await usageWith(() => {
      throw rejected();
    });

    expect(usage.items.map(item => [item.name, item.provider])).toEqual([
      ['linear', null],
      ['shared', null],
      ['private', null],
      ['unstamped', null]
    ]);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('lists the servers without providers when the name lookup fails', async () => {
    providers.getManyProvidersByIds.mockImplementation(async () => {
      throw new Error('Provider catalog unavailable');
    });

    let usage = await usageWith(stampedRows);

    expect(usage.items.every(item => item.provider === null)).toBe(true);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

let rejected = () => new ServiceError(badRequestError({ message: 'Field not allowed.' }));

describe('the providers of sessions', () => {
  beforeEach(() => {
    rpc.handlers['entity:list'] = () => ({ items: [], pagination: {} });
    rpc.handlers['session:list'] = () => ({
      object: 'list',
      items: [remoteSession()],
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    });
  });

  it('passes the providers to agent tracking and names those of each session', async () => {
    let paginator = await agentTrackingSessionService.listSessions({
      ...readers,
      providerIds: ['pro_linear', 'pro_github', 'pro_linear']
    });
    let page = await paginator.run({});

    expect(callsTo('session:list')[0]!.input.metorialProviderIds).toEqual([
      'pro_github',
      'pro_linear'
    ]);
    expect(page.items[0]!.providers).toEqual([
      { id: 'pro_gone', name: null },
      { id: 'pro_linear', name: 'Linear' }
    ]);
  });

  it('leaves the filter out when none is given', async () => {
    await (await agentTrackingSessionService.listSessions(readers)).run({});

    expect(callsTo('session:list')[0]!.input.metorialProviderIds).toBeUndefined();
  });

  it('withholds the names without provider read access, without looking them up', async () => {
    let page = await (await agentTrackingSessionService.listSessions(scope)).run({});

    expect(page.items[0]!.providers).toEqual([
      { id: 'pro_gone', name: null },
      { id: 'pro_linear', name: null }
    ]);
    expect(providers.getManyProvidersByIds).not.toHaveBeenCalled();
  });

  it('does not cache names for a viewer without provider read access', async () => {
    await (await agentTrackingSessionService.listSessions(readers)).run({});
    let page = await (await agentTrackingSessionService.listSessions(scope)).run({});

    expect(page.items[0]!.providers).toContainEqual({ id: 'pro_linear', name: null });
  });

  it('skips the lookup for an instance without an integrations environment', async () => {
    let page = await (
      await agentTrackingSessionService.listSessions({
        ...readers,
        instance: { ...scope.instance, subspaceEnvironmentId: null }
      })
    ).run({});

    expect(page.items[0]!.providers).toContainEqual({ id: 'pro_linear', name: null });
    expect(providers.getManyProvidersByIds).not.toHaveBeenCalled();
  });

  it('lists the sessions without names when the lookup fails', async () => {
    providers.getManyProvidersByIds.mockImplementation(async () => {
      throw new Error('Provider catalog unavailable');
    });

    let page = await (await agentTrackingSessionService.listSessions(readers)).run({});

    expect(page.items[0]!.providers).toEqual([
      { id: 'pro_gone', name: null },
      { id: 'pro_linear', name: null }
    ]);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('the provider filter values', () => {
  it('lists the providers tool calls reached in the range, with names', async () => {
    rpc.handlers['query:values'] = () => ({
      values: [
        { value: 'pro_linear', label: null, count: 4 },
        { value: 'pro_private', label: null, count: 1 }
      ],
      truncated: false
    });

    let values = await agentTrackingFilterValueService.listFilterValues({
      ...readers,
      field: 'provider',
      range: {}
    });

    expect(callsTo('query:values')[0]!.input).toMatchObject({
      dataset: 'tool_calls',
      field: 'metorial.provider'
    });
    expect(values.items).toEqual([
      expect.objectContaining({
        value: 'pro_linear',
        kind: 'provider',
        provider: { id: 'pro_linear', name: 'Linear' },
        requests: 4
      }),
      expect.objectContaining({
        value: 'pro_private',
        provider: { id: 'pro_private', name: null }
      })
    ]);
  });

  it('withholds the names without provider read access', async () => {
    rpc.handlers['query:values'] = () => ({
      values: [{ value: 'pro_linear', label: null, count: 4 }],
      truncated: false
    });

    let values = await agentTrackingFilterValueService.listFilterValues({
      ...scope,
      field: 'provider',
      range: {}
    });

    expect(values.items).toEqual([
      expect.objectContaining({ provider: { id: 'pro_linear', name: null } })
    ]);
    expect(providers.getManyProvidersByIds).not.toHaveBeenCalled();
  });

  it('describes held provider values and drops values that cannot be a provider', async () => {
    let values = await agentTrackingFilterValueService.listFilterValues({
      ...readers,
      field: 'provider',
      values: ['pro_linear', 'aten_repo'],
      range: {}
    });

    expect(callsTo('query:values')).toHaveLength(0);
    expect(values.items).toEqual([
      expect.objectContaining({
        value: 'pro_linear',
        provider: { id: 'pro_linear', name: 'Linear' }
      })
    ]);
  });

  it('refuses a range longer than tool call records are kept', async () => {
    let error = await rejection(
      agentTrackingFilterValueService.listFilterValues({
        ...readers,
        field: 'provider',
        range: { from: new Date('2026-07-01T00:00:00Z'), to: now }
      })
    );

    expect(error).toMatchObject({
      status: 400,
      message:
        'Provider values come from individual records, which are kept for 90 days. Choose a range of at most 90 days.'
    });
    expect(callsTo('query:values')).toHaveLength(0);
  });

  it('refuses provider values when the organization hides individuals', async () => {
    privacy.hideIndividuals = true;

    let error = await rejection(
      agentTrackingFilterValueService.listFilterValues({
        ...readers,
        field: 'provider',
        range: {}
      })
    );

    expect(error).toMatchObject({ status: 403, code: 'agent_tracking_individuals_hidden' });
    expect(rpc.calls).toHaveLength(0);
  });
});
