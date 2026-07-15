import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  listConnections: vi.fn(),
  listAgents: vi.fn(),
  getAgent: vi.fn(),
  listToolCalls: vi.fn(),
  getEndpoint: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/error', () => ({
  notFoundError: vi.fn((entity: string) => ({ entity })),
  ServiceError: class ServiceError extends Error {
    constructor(public detail: unknown) {
      super('Service error');
    }
  }
}));

vi.mock('@metorial/module-magic', () => ({
  magicMcpEndpointService: {
    getMagicMcpEndpointById: mocks.getEndpoint
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceAgentService: {
    list: mocks.listAgents,
    get: mocks.getAgent
  },
  subspaceIdentityCredentialService: {
    list: vi.fn()
  },
  subspaceSessionConnectionService: {
    list: mocks.listConnections
  },
  subspaceToolCallService: {
    list: mocks.listToolCalls
  }
}));

vi.mock('../src/services/consumerEntities/consumerActivityScope', () => ({
  consumerActivityScopeService: {
    resolve: mocks.resolve
  }
}));

import { consumerActivityService } from '../src/services/consumerEntities/consumerActivity';

let input = {
  instance: { oid: 10n },
  consumerProfile: { oid: 20n, instanceOid: 10n },
  accessTags: []
} as any;

let scope = {
  consumerActor: { id: 'actor_current' },
  magicMcpSessions: [
    {
      id: 'magic_current',
      subspaceSessionId: 'session_current',
      magicMcpEndpoint: {
        id: 'endpoint_current',
        oid: 40n,
        consumerProfileOid: 20n
      }
    }
  ],
  subspaceSessionIds: ['session_current']
};

let connection = (id: string, sessionId: string, agentId = 'agent_1') => ({
  id,
  sessionId,
  participant: { agentId }
});

let paginator = (items: any[]) => ({
  run: vi.fn(async () => ({
    items,
    pagination: { hasNextPage: false, hasPreviousPage: false }
  }))
});

describe('consumerActivityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue(scope);
  });

  it('lists actor-owned connections after their Magic MCP session mapping rotates', async () => {
    let historical = connection('connection_historical', 'session_historical');
    mocks.listConnections.mockResolvedValueOnce(paginator([historical]));

    let result = await consumerActivityService.listSessionConnections({
      ...input,
      pagination: { limit: 10 }
    });

    expect(mocks.listConnections).toHaveBeenCalledWith(
      expect.objectContaining({
        actorIds: ['actor_current'],
        sessionIds: undefined
      })
    );
    expect(result.items).toEqual([{ sessionConnection: historical, magicMcpSession: null }]);
  });

  it('enriches current connections without making current sessions the ownership boundary', async () => {
    let current = connection('connection_current', 'session_current');
    mocks.listConnections.mockResolvedValueOnce(paginator([current]));

    let result = await consumerActivityService.listSessionConnections({
      ...input,
      pagination: { limit: 10 }
    });

    expect(result.items[0]).toEqual({
      sessionConnection: current,
      magicMcpSession: scope.magicMcpSessions[0]
    });
  });

  it('scopes direct connection lookup to the consumer actor', async () => {
    mocks.listConnections.mockResolvedValueOnce(paginator([]));

    await expect(
      consumerActivityService.getSessionConnection({
        ...input,
        sessionConnectionId: 'connection_other_consumer'
      })
    ).rejects.toBeDefined();

    expect(mocks.listConnections).toHaveBeenCalledWith({
      instance: input.instance,
      allowDeleted: false,
      ids: ['connection_other_consumer'],
      actorIds: ['actor_current']
    });
  });

  it('allows historical session filters only when an actor-owned connection observed them', async () => {
    let historical = connection('connection_historical', 'session_historical');
    mocks.listConnections
      .mockResolvedValueOnce(paginator([historical]))
      .mockResolvedValueOnce(paginator([historical]));

    await consumerActivityService.listSessionConnections({
      ...input,
      pagination: { limit: 10 },
      sessionId: 'session_historical'
    });

    expect(mocks.listConnections).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        actorIds: ['actor_current'],
        sessionIds: ['session_historical']
      })
    );

    mocks.listConnections.mockReset();
    mocks.listConnections.mockResolvedValueOnce(paginator([]));
    await expect(
      consumerActivityService.listSessionConnections({
        ...input,
        pagination: { limit: 10 },
        sessionId: 'session_other_consumer'
      })
    ).rejects.toBeDefined();
    expect(mocks.listConnections).toHaveBeenCalledTimes(1);
  });

  it('derives agent and tool-call connection access from actor-owned connections', async () => {
    let owned = connection('connection_owned', 'session_historical', 'agent_owned');
    mocks.listConnections.mockResolvedValue(paginator([owned]));
    mocks.listAgents.mockResolvedValue(paginator([{ id: 'agent_owned' }]));
    mocks.listToolCalls.mockResolvedValue(paginator([]));

    await consumerActivityService.listAgents({
      ...input,
      pagination: { limit: 10 }
    });
    expect(mocks.listAgents).toHaveBeenCalledWith(
      expect.objectContaining({ actorIds: ['actor_current'] })
    );

    await consumerActivityService.listToolCalls({
      ...input,
      pagination: { limit: 10 },
      sessionConnectionId: 'connection_owned'
    });
    expect(mocks.listToolCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        actorIds: ['actor_current'],
        connectionIds: ['connection_owned']
      })
    );

    mocks.listConnections.mockReset();
    mocks.listConnections.mockResolvedValueOnce(paginator([]));
    await expect(
      consumerActivityService.listToolCalls({
        ...input,
        pagination: { limit: 10 },
        sessionConnectionId: 'connection_other_consumer'
      })
    ).rejects.toBeDefined();
  });
});
