import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    toolCall: { findMany: vi.fn() },
    sessionMessage: { findMany: vi.fn() }
  }
}));

vi.mock('@lowerdeck/lock', () => ({ createLock: vi.fn(() => ({})) }));
vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial-subspace/connection-utils', () => ({
  GET_PAYLOAD_LIMIT_BYTES: 1,
  LIST_PAYLOAD_LIMIT_BYTES: 1
}));
vi.mock('@metorial-subspace/list-utils', () => {
  let none = async () => undefined;

  return {
    checkDeletedRelation: vi.fn(),
    mergeRetentionWithDateFilter: () => undefined,
    normalizeDateFilter: vi.fn(),
    normalizeStatusForGet: vi.fn(),
    normalizeStatusForList: () => ({ onlyParent: {} }),
    resolveAgents: none,
    resolveIdentities: none,
    resolveIdentityActors: none,
    resolveProviderAuthConfigs: none,
    resolveProviderConfigs: none,
    resolveProviderDeployments: none,
    resolveProviders: none,
    resolveProviderTools: none,
    resolveSessions: none,
    resolveSessionTemplates: none
  };
});
vi.mock('@metorial-subspace/module-agent', () => ({
  agentInstanceService: {},
  agentService: {}
}));
vi.mock('@metorial-subspace/module-catalog', () => ({ getProviderTenantFilter: vi.fn() }));
vi.mock('@metorial-subspace/module-search', () => ({
  searchRelatedEntities: vi.fn(),
  whenRelatedMatched: vi.fn()
}));
vi.mock('@metorial-subspace/module-connection', () => ({ SenderManager: {} }));
vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 9 })),
  resolveMetorialFacing: vi.fn(),
  toProviderEventBase: vi.fn()
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../lib/enrichSessionParticipants', () => ({
  enrichSessionParticipantsWithConsumer: vi.fn()
}));
vi.mock('../lib/sessionVisibility', () => ({
  assertSessionVisible: vi.fn(),
  getSessionVisibilityWhere: vi.fn()
}));
vi.mock('./sessionMessage', () => ({
  sessionMessageBodyOmit: {},
  sessionMessageInclude: {},
  sessionMessageService: { enrichMessages: vi.fn(async (messages: any[]) => messages) }
}));

import { toolCallService } from './toolCall';

let scope = {
  tenant: { oid: 2n, id: 'ten_1' },
  environment: { oid: 3n, id: 'env_1' }
} as any;

let listWhere = async (params: Record<string, unknown>) => {
  let paginator = await toolCallService.listToolCallsInternal({ ...scope, ...params });
  await paginator.run({ limit: 10 });

  return db.toolCall.findMany.mock.calls[0]![0].where;
};

describe('toolCallService client call id lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.toolCall.findMany.mockResolvedValue([]);
    db.sessionMessage.findMany.mockResolvedValue([]);
  });

  it('filters by client call ids and source inside the tenant and environment', async () => {
    let where = await listWhere({
      clientCallIds: ['toolu_1', 'toolu_2'],
      clientCallSource: 'claude-code'
    });

    expect(where).toMatchObject({ tenantOid: 2n, solutionOid: 9, environmentOid: 3n });
    expect(where.AND).toContainEqual({ clientCallId: { in: ['toolu_1', 'toolu_2'] } });
    expect(where.AND).toContainEqual({ clientCallSource: 'claude-code' });
  });

  it('removes duplicate ids before querying', async () => {
    let where = await listWhere({ clientCallIds: ['toolu_1', 'toolu_1', 'toolu_2'] });

    expect(where.AND).toContainEqual({ clientCallId: { in: ['toolu_1', 'toolu_2'] } });
  });

  it('matches nothing for an empty list', async () => {
    let where = await listWhere({ clientCallIds: [] });

    expect(where.AND).toContainEqual({ clientCallId: { in: [] } });
  });

  it('accepts 200 distinct ids, counting duplicates once', async () => {
    let ids = Array.from({ length: 200 }, (_, i) => `toolu_${i}`);

    let where = await listWhere({ clientCallIds: [...ids, ...ids] });

    expect(where.AND).toContainEqual({ clientCallId: { in: ids } });
  });

  it('rejects more than 200 distinct ids without querying', async () => {
    let ids = Array.from({ length: 201 }, (_, i) => `toolu_${i}`);

    await expect(
      toolCallService.listToolCallsInternal({ ...scope, clientCallIds: ids })
    ).rejects.toThrow('At most 200 client call ids');
    expect(db.toolCall.findMany).not.toHaveBeenCalled();
  });

  it('loads message bodies unless they are left out', async () => {
    db.toolCall.findMany.mockResolvedValue([{ id: 'tcl_1', messageOid: 1n }]);
    let enrich = (await import('./sessionMessage')).sessionMessageService.enrichMessages;

    await listWhere({});
    expect(vi.mocked(enrich).mock.calls[0]![1]).toEqual({ bodyLimitBytes: 1 });

    vi.mocked(enrich).mockClear();
    await listWhere({ omitBodies: true });
    expect(vi.mocked(enrich).mock.calls[0]![1]).toBeUndefined();
  });

  it('adds no client call filter when none is given', async () => {
    let where = await listWhere({});

    expect(JSON.stringify(where.AND)).not.toContain('clientCall');
  });
});
