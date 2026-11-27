import { badRequestError, ServiceError } from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@lowerdeck/sentry', () => ({ getSentry: () => sentry }));

import { agentTrackingToolService } from '../src/services/agentTrackingTool';
import {
  callsTo,
  desktop,
  deviceSkills,
  privacy,
  rejection,
  resetMocks,
  rpc,
  scope,
  skills
} from './_mocks';

let now = new Date('2026-11-22T12:00:00Z');

type Result = { rows: Record<string, unknown>[]; meta?: Record<string, unknown> };

let answer = (results: (query: any) => Result) => {
  rpc.handlers['query:run'] = (({ query }: any) => ({
    totals: null,
    labels: {},
    meta: {},
    ...results(query)
  })) as any;
};

let dimensionsOf = (query: any) =>
  (query.dimensions ?? []).map((dimension: any) => dimension.field ?? dimension).join(',');

let calls = (calls: number, extra: Record<string, unknown> = {}) => ({
  tool_calls: calls,
  'tool_calls.failed': 1,
  'tool_calls.error_rate': 1 / calls,
  'users.active': 2,
  last_used: '2026-11-21T09:30:00+00:00',
  ...extra
});

beforeEach(() => {
  resetMocks();
  sentry.captureException.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe('skill usage', () => {
  it('lists skills by their named activations with the totals of all activations', async () => {
    desktop.toolDetails = true;
    answer(query => {
      if (dimensionsOf(query) == 'skill.name') {
        return {
          rows: [
            {
              'skill.name': 'pdf',
              'skill_activations.named': 7,
              'users.active': 3,
              last_used: '2026-11-21T09:30:00+00:00'
            }
          ],
          meta: { truncated: true }
        };
      }

      return {
        rows: [{ skill_activations: 12, 'skill_activations.named': 7, 'users.active': 4 }],
        meta: { warnings: [{ code: 'distinct_capped' }] }
      };
    });

    let usage = await agentTrackingToolService.getSkillUsage({
      ...scope,
      range: { preset: 'last_7_days', timeZone: 'Europe/Berlin' }
    });

    let queries = callsTo('query:run').map(call => call.input.query);
    expect(queries.map(query => query.dataset)).toEqual([
      'skill_activations',
      'skill_activations'
    ]);
    expect(queries[0]).toMatchObject({
      measures: ['skill_activations', 'skill_activations.named', 'users.active']
    });
    expect(queries[1]).toMatchObject({
      dimensions: [{ field: 'skill.name', missing: 'exclude' }],
      measures: ['skill_activations.named', 'users.active', 'last_used'],
      having: { field: 'skill_activations.named', op: 'gt', value: 0 },
      timeZone: 'Europe/Berlin',
      limit: 500
    });

    expect(usage).toMatchObject({
      range: { preset: 'last_7_days', timeZone: 'Europe/Berlin', to: now },
      toolDetails: true,
      summary: { activations: 12, namedActivations: 7, members: 4, countsCapped: true },
      items: [
        {
          name: 'pdf',
          activations: 7,
          members: 3,
          lastUsedAt: new Date('2026-11-21T09:30:00Z')
        }
      ],
      truncated: true
    });
  });
});

describe('the Metorial skill of each reported skill', () => {
  let readers = { ...scope, canReadSkills: true };

  let devicesQuery = (query: any) => dimensionsOf(query) == 'skill.name,skill.source,device';

  let reportedNames = [
    'billing',
    'mine',
    'split',
    'nodevice',
    'revoked',
    'project',
    'foreign',
    'gone'
  ];

  let activation = (name: string, device: string | null, source: string | null = 'user') => ({
    'skill.name': name,
    'skill.source': source,
    device,
    'skill_activations.named': 1
  });

  let deviceRows: Result = {
    rows: [
      activation('billing', 'aten_mac', 'userSettings'),
      activation('billing', 'aten_air', null),
      activation('mine', 'aten_mac'),
      activation('mine', 'aten_bob'),
      activation('split', 'aten_mac'),
      activation('split', 'aten_air'),
      activation('nodevice', 'aten_mac'),
      activation('nodevice', null),
      activation('revoked', 'aten_revoked'),
      activation('project', 'aten_mac'),
      activation('project', 'aten_mac', 'projectSettings'),
      activation('foreign', 'aten_vendor'),
      activation('gone', 'aten_mac')
    ]
  };

  let entities: Record<string, { source: string | null; ref: string | null }> = {
    aten_mac: { source: 'metorial.device', ref: 'codv_mac' },
    aten_air: { source: 'metorial.device', ref: 'codv_air' },
    aten_bob: { source: 'metorial.device', ref: 'codv_bob' },
    aten_revoked: { source: 'metorial.device', ref: 'codv_revoked' },
    aten_vendor: { source: null, ref: null }
  };

  let usageWith = async (
    devices: (() => Result) | Result,
    d: Record<string, unknown> = readers
  ) => {
    answer(query => {
      if (dimensionsOf(query) == 'skill.name') {
        return {
          rows: reportedNames.map(name => ({
            'skill.name': name,
            'skill_activations.named': 1
          }))
        };
      }
      if (devicesQuery(query)) return typeof devices == 'function' ? devices() : devices;

      return { rows: [] };
    });

    return await agentTrackingToolService.getSkillUsage({ ...(d as any), range: {} });
  };

  let linked = (usage: { items: { name: string; skill: unknown }[] }) =>
    usage.items.map(item => [item.name, item.skill]);

  let mapping = (
    consumerDeviceId: string,
    name: string,
    skillOid: bigint,
    status = 'active'
  ) => ({
    instanceOid: 3n,
    consumerDeviceId,
    consumerDeviceStatus: status,
    name,
    skillOid
  });

  beforeEach(() => {
    rpc.handlers['entity:list'] = (input: any) => ({
      items: input.ids
        .filter((id: string) => entities[id])
        .map((id: string) => ({ id, kind: 'device', status: 'managed', ...entities[id] })),
      pagination: {}
    });
    skills.rows = [
      {
        oid: 10n,
        id: 'skl_billing',
        name: 'Billing Playbook',
        instanceOid: 3n,
        status: 'active'
      },
      { oid: 12n, id: 'skl_other', name: 'Other', instanceOid: 3n, status: 'active' },
      { oid: 13n, id: 'skl_gone', name: 'Gone', instanceOid: 3n, status: 'deleted' }
    ];
    deviceSkills.rows = [
      mapping('codv_mac', 'billing', 10n),
      mapping('codv_air', 'billing', 10n),
      mapping('codv_mac', 'mine', 10n),
      mapping('codv_mac', 'split', 10n),
      mapping('codv_air', 'split', 12n),
      mapping('codv_mac', 'nodevice', 10n),
      mapping('codv_revoked', 'revoked', 10n, 'revoked'),
      mapping('codv_mac', 'project', 10n),
      mapping('codv_mac', 'gone', 13n)
    ];
  });

  it('links a name only when every activating device installed the same skill under it', async () => {
    let usage = await usageWith(deviceRows);

    expect(linked(usage)).toEqual(
      reportedNames.map(name => [
        name,
        name == 'billing' ? { id: 'skl_billing', name: 'Billing Playbook' } : null
      ])
    );
    expect(callsTo('entity:list')[0]!.input).toMatchObject({
      organizationId: 'org_1',
      kinds: ['device'],
      ids: ['aten_air', 'aten_bob', 'aten_mac', 'aten_revoked', 'aten_vendor']
    });
    expect(deviceSkills.findMany.mock.calls[0]![0].where).toMatchObject({
      instanceOid: 3n,
      consumerDevice: { status: 'active' }
    });
    expect(
      callsTo('query:run')
        .map(call => call.input.query)
        .find(devicesQuery)
    ).toMatchObject({
      dataset: 'skill_activations',
      dimensions: [
        { field: 'skill.name', missing: 'exclude' },
        { field: 'skill.source', missing: 'null' },
        { field: 'device', missing: 'null' }
      ],
      limit: 10_000
    });
  });

  it("does not link another member's own skill of the same name", async () => {
    let usage = await usageWith({ rows: [activation('mine', 'aten_bob')] });

    expect(usage.items.find(item => item.name == 'mine')!.skill).toBeNull();
  });

  it('ignores the mapping of a device that is no longer active', async () => {
    deviceSkills.rows = [mapping('codv_mac', 'billing', 10n, 'revoked')];

    let usage = await usageWith({ rows: [activation('billing', 'aten_mac')] });

    expect(usage.items.every(item => item.skill === null)).toBe(true);
  });

  it('links none when the devices were cut off, without looking them up', async () => {
    let usage = await usageWith({ ...deviceRows, meta: { truncated: true } });

    expect(usage.items.every(item => item.skill === null)).toBe(true);
    expect(callsTo('entity:list')).toHaveLength(0);
    expect(deviceSkills.findMany).not.toHaveBeenCalled();
  });

  it('links none without skill read access, without asking for devices', async () => {
    let usage = await usageWith(deviceRows, scope);

    expect(usage.items).toHaveLength(reportedNames.length);
    expect(usage.items.every(item => item.skill === null)).toBe(true);
    expect(
      callsTo('query:run')
        .map(call => call.input.query)
        .some(devicesQuery)
    ).toBe(false);
    expect(callsTo('entity:list')).toHaveLength(0);
    expect(deviceSkills.findMany).not.toHaveBeenCalled();
  });

  it('does not reuse the answer of a viewer without skill read access', async () => {
    await usageWith(deviceRows, scope);
    let usage = await usageWith(deviceRows);

    expect(usage.items[0]!.skill).toEqual({ id: 'skl_billing', name: 'Billing Playbook' });
  });

  it('lists the skills without links when the device query is refused', async () => {
    let usage = await usageWith(() => {
      throw new ServiceError(badRequestError({ message: 'Field not allowed.' }));
    });

    expect(usage.items.map(item => item.name)).toEqual(reportedNames);
    expect(usage.items.every(item => item.skill === null)).toBe(true);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('lists the skills without links when the device lookup fails', async () => {
    deviceSkills.findMany.mockImplementation(async () => {
      throw new Error('Database unavailable');
    });

    let usage = await usageWith(deviceRows);

    expect(usage.items.every(item => item.skill === null)).toBe(true);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('MCP server usage', () => {
  it('lists servers with their tools and failure rates', async () => {
    answer(query => {
      let dimensions = dimensionsOf(query);
      if (dimensions == 'mcp.server') {
        return {
          rows: [
            { 'mcp.server': 'github', ...calls(4) },
            {
              'mcp.server': 'figma',
              ...calls(2, { 'tool_calls.failed': 0, 'tool_calls.error_rate': 0 })
            }
          ]
        };
      }
      if (dimensions == 'mcp.server,mcp.tool') {
        return {
          rows: [
            { 'mcp.server': 'github', 'mcp.tool': 'create_issue', ...calls(3) },
            { 'mcp.server': 'github', 'mcp.tool': 'search', ...calls(1) },
            { 'mcp.server': 'figma', 'mcp.tool': 'get_file', ...calls(2) }
          ]
        };
      }

      return {
        rows: [
          {
            mcp_calls: 10,
            'mcp_calls.failed': 2,
            'mcp_calls.error_rate': 0.2,
            'mcp_calls.named': 6,
            'mcp_calls.users': 3,
            'mcp_calls.last_used': '2026-11-21T09:30:00+00:00'
          }
        ]
      };
    });

    let usage = await agentTrackingToolService.getMcpServerUsage({
      ...scope,
      range: { preset: 'last_30_days' }
    });

    let queries = callsTo('query:run').map(call => call.input.query);
    expect(queries.map(dimensionsOf)).toEqual(['', 'mcp.server', 'mcp.server,mcp.tool']);
    expect(queries[0]).not.toHaveProperty('where');
    expect(queries[0]).toMatchObject({
      measures: [
        'mcp_calls',
        'mcp_calls.failed',
        'mcp_calls.error_rate',
        'mcp_calls.users',
        'mcp_calls.last_used',
        'mcp_calls.named'
      ]
    });
    for (let query of queries.slice(1)) {
      expect(query).toMatchObject({
        dataset: 'tool_calls',
        where: { field: 'tool.kind', op: 'eq', value: 'mcp' },
        measures: [
          'tool_calls',
          'tool_calls.failed',
          'tool_calls.error_rate',
          'users.active',
          'last_used'
        ]
      });
    }

    expect(usage.toolDetails).toBe(false);
    expect(usage.summary).toEqual({
      calls: 10,
      failed: 2,
      errorRate: 0.2,
      members: 3,
      lastUsedAt: new Date('2026-11-21T09:30:00Z'),
      namedCalls: 6,
      countsCapped: false
    });
    expect(usage.items).toMatchObject([
      {
        name: 'github',
        calls: 4,
        failed: 1,
        errorRate: 0.25,
        tools: [
          { name: 'create_issue', calls: 3 },
          { name: 'search', calls: 1 }
        ]
      },
      { name: 'figma', errorRate: 0, tools: [{ name: 'get_file' }] }
    ]);
    expect(usage.truncated).toBe(false);
  });

  it('presents an empty instance with a null rate', async () => {
    answer(() => ({ rows: [] }));

    let usage = await agentTrackingToolService.getMcpServerUsage({ ...scope, range: {} });

    expect(usage.summary).toMatchObject({ calls: 0, errorRate: null, lastUsedAt: null });
    expect(usage.items).toEqual([]);
  });
});

describe('tool usage limits', () => {
  it('refuses when the organization hides individuals', async () => {
    privacy.hideIndividuals = true;

    for (let read of [
      agentTrackingToolService.getSkillUsage({ ...scope, range: {} }),
      agentTrackingToolService.getMcpServerUsage({ ...scope, range: {} })
    ]) {
      expect(await rejection(read)).toMatchObject({
        status: 403,
        code: 'agent_tracking_individuals_hidden'
      });
    }
    expect(callsTo('query:run')).toHaveLength(0);
  });

  it('refuses a range longer than the records are kept', async () => {
    let error = await rejection(
      agentTrackingToolService.getSkillUsage({
        ...scope,
        range: { from: new Date('2026-07-01T00:00:00Z'), to: now }
      })
    );

    expect(error).toMatchObject({
      status: 400,
      message:
        'Skill and MCP usage come from individual records, which are kept for 90 days. Choose a range of at most 90 days.'
    });
    expect(callsTo('query:run')).toHaveLength(0);
  });
});
