import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  dailyPacedDelay: vi.fn(() => ({ delay: 0 }))
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((config, handler) => ({ config, handler }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    magicMcpServer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    magicMcpEndpoint: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  magicMcpServerBackingService: {
    getMagicMcpServerBackingById: vi.fn()
  },
  magicMcpEndpointBackingService: {
    getMagicMcpEndpointBackingById: vi.fn()
  }
}));

vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpEndpointBacking: vi.fn(),
  ensureMagicMcpServerBacking: vi.fn(),
  getConsumerOwnerForProfile: vi.fn(),
  getConsumerOwnerProfileOidForServer: vi.fn()
}));

vi.mock('../src/lib/ownerActor', () => ({
  resolveOwnerActorOid: vi.fn()
}));

import { ServiceError, notFoundError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import {
  magicMcpEndpointBackingService,
  magicMcpServerBackingService
} from '@metorial-subspace/module-integration';
import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking,
  getConsumerOwnerForProfile,
  getConsumerOwnerProfileOidForServer
} from '../src/lib/backing';
import { resolveOwnerActorOid } from '../src/lib/ownerActor';
import {
  reconcileMagicMcpEndpointOwnerIdentitiesManyQueueProcessor,
  reconcileMagicMcpEndpointOwnerIdentity,
  reconcileMagicMcpEndpointOwnerIdentityQueue,
  reconcileMagicMcpServerOwnerIdentitiesManyQueue,
  reconcileMagicMcpServerOwnerIdentitiesManyQueueProcessor,
  reconcileMagicMcpServerOwnerIdentity,
  reconcileMagicMcpServerOwnerIdentityQueue
} from '../src/queues/ownerIdentity';

let instance = { oid: 10n, projectOid: 11n };

let consumerActor = (oid: bigint, id: string) => ({ oid, id, type: 'consumer' });

let createServer = (overrides: Record<string, any> = {}) => ({
  oid: 20n,
  id: 'magic_server',
  source: 'manual',
  status: 'active',
  hasSubspaceBacking: true,
  legacySubspaceSessionTemplateId: null,
  subspaceIntegrationInstanceId: null,
  ownerActorOid: null,
  ownerActor: null,
  instance,
  ...overrides
});

let createBacking = (d: {
  identityActor?: ReturnType<typeof consumerActor> | null;
  identity?: { id: string; actorOid: bigint } | null;
  actor?: ReturnType<typeof consumerActor> | null;
}) => ({
  integrationInstance: {
    identityActor: d.identityActor ?? null,
    identity: d.identity ?? null
  },
  actor: d.actor ?? null
});

let mockState = (d: {
  server?: Record<string, any> | null;
  expectedOwner?: { identityActorId?: string | null; identityId?: string | null };
  backing: ReturnType<typeof createBacking>;
}) => {
  vi.mocked(db.magicMcpServer.findFirst).mockResolvedValue(
    (d.server === undefined ? createServer() : d.server) as any
  );
  vi.mocked(getConsumerOwnerProfileOidForServer).mockResolvedValue(
    d.expectedOwner ? 50n : null
  );
  vi.mocked(getConsumerOwnerForProfile).mockResolvedValue(d.expectedOwner ?? {});
  vi.mocked(magicMcpServerBackingService.getMagicMcpServerBackingById).mockResolvedValue(
    d.backing as any
  );
  vi.mocked(resolveOwnerActorOid).mockImplementation(async owner =>
    owner?.identityActorId ? (ownerActorOids[owner.identityActorId] ?? null) : null
  );
};

let ownerActorOids: Record<string, bigint> = {
  actor_owner: 30n,
  actor_person: 31n,
  actor_stamped: 32n
};

let stampedOwnerActor = {
  ownerActorOid: 32n,
  ownerActor: { type: 'consumer' }
};

let stampedBacking = () =>
  createBacking({
    identityActor: consumerActor(1n, 'actor_stamped'),
    identity: { id: 'identity_stamped', actorOid: 1n },
    actor: consumerActor(1n, 'actor_stamped')
  });

describe('Magic MCP server owner identity reconciler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears a stamped consumer identity from a server without a consumer owner', async () => {
    mockState({ backing: stampedBacking() });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).toHaveBeenCalledWith({
      instance,
      server: expect.objectContaining({ id: 'magic_server' }),
      owner: { identityActorId: null, identityId: null }
    });
  });

  it('replaces a stamped consumer identity with the owning consumer', async () => {
    mockState({
      expectedOwner: { identityActorId: 'actor_owner', identityId: 'identity_owner' },
      backing: stampedBacking()
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { identityActorId: 'actor_owner', identityId: 'identity_owner' }
      })
    );
  });

  it('leaves servers that already carry their owner untouched', async () => {
    mockState({
      expectedOwner: { identityActorId: 'actor_stamped', identityId: 'identity_stamped' },
      backing: stampedBacking()
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('leaves servers without any identity or owner untouched', async () => {
    mockState({ backing: createBacking({}) });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('never adds an identity to servers that carry none', async () => {
    mockState({
      expectedOwner: { identityActorId: 'actor_owner', identityId: 'identity_owner' },
      backing: createBacking({})
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('never overwrites person or agent identities', async () => {
    let person = { oid: 2n, id: 'actor_person', type: 'person' };
    mockState({
      backing: createBacking({
        identityActor: person as any,
        identity: { id: 'identity_person', actorOid: 2n },
        actor: person as any
      })
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('never overwrites an identity whose actor is unknown', async () => {
    mockState({
      backing: createBacking({ identity: { id: 'identity_other', actorOid: 3n } })
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('only compares the session actor on servers backed by their own integration instance', async () => {
    mockState({
      server: createServer({ subspaceIntegrationInstanceId: 'ii_user' }),
      backing: createBacking({
        identityActor: { oid: 4n, id: 'actor_person', type: 'person' } as any,
        identity: { id: 'identity_person', actorOid: 4n },
        actor: consumerActor(1n, 'actor_stamped')
      })
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { identityActorId: null, identityId: null }
      })
    );
  });

  it('skips servers that no longer qualify or have no backing', async () => {
    mockState({ server: null, backing: stampedBacking() });
    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    mockState({ backing: stampedBacking() });
    vi.mocked(magicMcpServerBackingService.getMagicMcpServerBackingById).mockRejectedValue(
      new ServiceError(notFoundError('magic_mcp.server_backing', 'magic_server'))
    );
    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('leaves consumer-deployed servers without any consumer link untouched', async () => {
    mockState({
      server: createServer({ ...stampedOwnerActor, source: 'consumer_provider_template' }),
      backing: stampedBacking()
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
    expect(db.magicMcpServer.updateMany).not.toHaveBeenCalled();
  });

  it('pages through backed servers and fans out one job per server', async () => {
    let servers = Array.from({ length: 500 }, (_, index) => ({
      id: `mgsr_${String(index).padStart(3, '0')}`
    }));
    vi.mocked(db.magicMcpServer.findMany).mockResolvedValue(servers as any);

    await (reconcileMagicMcpServerOwnerIdentitiesManyQueueProcessor as any).handler({
      cursor: 'mgsr_prev'
    });

    expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'active',
          hasSubspaceBacking: true,
          id: { gt: 'mgsr_prev' }
        },
        take: 500
      })
    );
    expect(reconcileMagicMcpServerOwnerIdentityQueue.addManyWithOps).toHaveBeenCalledWith(
      servers.map(server => ({
        data: { magicMcpServerId: server.id },
        opts: { id: server.id }
      }))
    );
    expect(reconcileMagicMcpServerOwnerIdentitiesManyQueue.add).toHaveBeenCalledWith(
      { cursor: 'mgsr_499' },
      { delay: 0 }
    );
  });

  it('clears a stamped consumer owner actor from a server without a consumer owner', async () => {
    mockState({ server: createServer(stampedOwnerActor), backing: createBacking({}) });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(db.magicMcpServer.updateMany).toHaveBeenCalledWith({
      where: { oid: 20n, ownerActorOid: 32n },
      data: { ownerActorOid: null }
    });
  });

  it('replaces a stamped consumer owner actor with the owning consumer', async () => {
    mockState({
      server: createServer(stampedOwnerActor),
      expectedOwner: { identityActorId: 'actor_owner', identityId: 'identity_owner' },
      backing: stampedBacking()
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(db.magicMcpServer.updateMany).toHaveBeenCalledWith({
      where: { oid: 20n, ownerActorOid: 32n },
      data: { ownerActorOid: 30n }
    });
  });

  it('keeps owner actors that are correct, unset, or not consumers', async () => {
    mockState({
      server: createServer(stampedOwnerActor),
      expectedOwner: { identityActorId: 'actor_stamped', identityId: 'identity_stamped' },
      backing: stampedBacking()
    });
    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    mockState({ server: createServer(), backing: createBacking({}) });
    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    mockState({
      server: createServer({ ownerActorOid: 31n, ownerActor: { type: 'person' } }),
      backing: createBacking({})
    });
    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(db.magicMcpServer.updateMany).not.toHaveBeenCalled();
  });

  it('uses the own integration instance actor as owner when there is no consumer owner', async () => {
    mockState({
      server: createServer({ ...stampedOwnerActor, subspaceIntegrationInstanceId: 'ii_user' }),
      backing: createBacking({
        identityActor: { oid: 4n, id: 'actor_person', type: 'person' } as any,
        identity: { id: 'identity_person', actorOid: 4n }
      })
    });

    await reconcileMagicMcpServerOwnerIdentity({ magicMcpServerId: 'magic_server' });

    expect(db.magicMcpServer.updateMany).toHaveBeenCalledWith({
      where: { oid: 20n, ownerActorOid: 32n },
      data: { ownerActorOid: 31n }
    });
  });
});

describe('Magic MCP endpoint owner identity reconciler', () => {
  let endpoint = { oid: 40n, id: 'magic_endpoint', instance };

  let member = (d: {
    identityActor?: Record<string, any> | null;
    identity?: { id: string; actorOid: bigint } | null;
  }) => ({
    magicMcpServerBacking: {
      integrationInstance: {
        identityActor: d.identityActor ?? null,
        identity: d.identity ?? null
      }
    }
  });

  let stampedGroup = {
    identityActor: consumerActor(1n, 'actor_stamped'),
    identity: { id: 'identity_stamped', actorOid: 1n }
  };

  let mockEndpoint = (d: {
    group: { identityActor: Record<string, any> | null; identity: Record<string, any> | null };
    servers: ReturnType<typeof member>[];
  }) => {
    vi.mocked(db.magicMcpEndpoint.findFirst).mockResolvedValue(endpoint as any);
    vi.mocked(magicMcpEndpointBackingService.getMagicMcpEndpointBackingById).mockResolvedValue(
      { integrationGroup: d.group, servers: d.servers } as any
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears a consumer identity that no member server carries anymore', async () => {
    mockEndpoint({ group: stampedGroup, servers: [member({})] });

    await reconcileMagicMcpEndpointOwnerIdentity({ magicMcpEndpointId: 'magic_endpoint' });

    expect(ensureMagicMcpEndpointBacking).toHaveBeenCalledWith({
      instance,
      endpoint,
      owner: { identityActorId: null, identityId: null }
    });
  });

  it('lets the endpoint pick up another member identity instead', async () => {
    let person = { oid: 2n, id: 'actor_person', type: 'person' };
    mockEndpoint({
      group: stampedGroup,
      servers: [member({}), member({ identityActor: person })]
    });

    await reconcileMagicMcpEndpointOwnerIdentity({ magicMcpEndpointId: 'magic_endpoint' });

    expect(ensureMagicMcpEndpointBacking).toHaveBeenCalledWith({
      instance,
      endpoint,
      owner: undefined
    });
  });

  it('leaves identities a member still carries, person identities, and empty groups alone', async () => {
    mockEndpoint({ group: stampedGroup, servers: [member(stampedGroup)] });
    await reconcileMagicMcpEndpointOwnerIdentity({ magicMcpEndpointId: 'magic_endpoint' });

    mockEndpoint({
      group: {
        identityActor: { oid: 2n, id: 'actor_person', type: 'person' },
        identity: null
      },
      servers: [member({})]
    });
    await reconcileMagicMcpEndpointOwnerIdentity({ magicMcpEndpointId: 'magic_endpoint' });

    mockEndpoint({ group: { identityActor: null, identity: null }, servers: [member({})] });
    await reconcileMagicMcpEndpointOwnerIdentity({ magicMcpEndpointId: 'magic_endpoint' });

    vi.mocked(db.magicMcpEndpoint.findFirst).mockResolvedValue(null);
    await reconcileMagicMcpEndpointOwnerIdentity({ magicMcpEndpointId: 'magic_endpoint' });

    expect(ensureMagicMcpEndpointBacking).not.toHaveBeenCalled();
  });

  it('pages through org endpoints and fans out one job per endpoint', async () => {
    let endpoints = [{ id: 'mgep_a' }, { id: 'mgep_b' }];
    vi.mocked(db.magicMcpEndpoint.findMany).mockResolvedValue(endpoints as any);

    await (reconcileMagicMcpEndpointOwnerIdentitiesManyQueueProcessor as any).handler({});

    expect(db.magicMcpEndpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'active',
          hasSubspaceBacking: true,
          consumerProfileOid: null,
          id: undefined
        }
      })
    );
    expect(reconcileMagicMcpEndpointOwnerIdentityQueue.addManyWithOps).toHaveBeenCalledWith(
      endpoints.map(endpoint => ({
        data: { magicMcpEndpointId: endpoint.id },
        opts: { id: endpoint.id }
      }))
    );
  });
});
