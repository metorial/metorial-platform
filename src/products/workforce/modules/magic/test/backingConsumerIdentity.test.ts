import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => {
  let db = {
    project: {
      findUniqueOrThrow: vi.fn()
    },
    consumerActor: {
      findFirst: vi.fn()
    },
    identityActor: {
      findUnique: vi.fn()
    },
    consumerIntegration: {
      findFirst: vi.fn()
    },
    providerTemplate: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    magicMcpServer: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    magicMcpEndpoint: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    magicMcpEndpointServer: {
      findMany: vi.fn(),
      update: vi.fn()
    }
  };

  return {
    db,
    ID: {
      generateId: vi.fn().mockResolvedValue('generated-id')
    }
  };
});

vi.mock('@metorial-subspace/module-integration', () => ({
  magicMcpServerBackingService: {
    upsertMagicMcpServerBacking: vi.fn()
  },
  magicMcpEndpointBackingService: {
    upsertMagicMcpEndpointBacking: vi.fn()
  },
  integrationInstanceService: {}
}));

import { db } from '@metorial/db';
import {
  magicMcpEndpointBackingService,
  magicMcpServerBackingService
} from '@metorial-subspace/module-integration';
import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking
} from '../src/lib/backing';

let createServer = (overrides: Record<string, any>) =>
  ({
    providerTemplateId: null,
    subspaceIntegrationInstanceId: null,
    name: 'Consumer server',
    description: null,
    metadata: {},
    legacySubspaceSessionTemplateId: null,
    ownerActorOid: null,
    source: 'consumer_provider_template',
    hasSubspaceBacking: false,
    ...overrides
  }) as any;

describe('Magic MCP consumer identity backing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.project.findUniqueOrThrow).mockResolvedValue({
      magicMcpSessionDurationMinutes: 60
    } as any);
    vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking).mockResolvedValue({
      ownerType: 'server_owned',
      ephemeralManagedSession: { id: 'ems_server', isReconciling: false }
    } as any);
    vi.mocked(magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking).mockResolvedValue({
      ephemeralManagedSession: { id: 'ems_endpoint', isReconciling: false }
    } as any);
    vi.mocked(db.magicMcpServer.update).mockImplementation(
      (async (args: any) => ({ oid: args.where.oid, ...args.data }) as any) as any
    );
    vi.mocked(db.magicMcpServer.findUnique).mockImplementation(
      (async (args: any) =>
        ({
          oid: args.where.oid,
          id: 'linked_server',
          hasSubspaceBacking: true,
          subspaceEphemeralManagedSessionId: 'ems_server',
          isSubspaceBackingReconciling: false
        }) as any) as any
    );
    vi.mocked(db.magicMcpEndpoint.update).mockImplementation(
      (async (args: any) => args.data as any) as any
    );
  });

  it('uses the oldest consumer-owned access grant as the server owner', async () => {
    vi.mocked(db.consumerIntegration.findFirst).mockResolvedValueOnce({
      consumerProfileOid: 30n
    } as any);
    vi.mocked(db.consumerActor.findFirst).mockResolvedValue({
      id: 'actor_consumer',
      defaultIdentityId: 'identity_consumer'
    } as any);

    await ensureMagicMcpServerBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      server: createServer({ oid: 20n, id: 'magic_server', source: 'manual' })
    });

    expect(db.consumerIntegration.findFirst).toHaveBeenCalledTimes(1);
    expect(db.consumerIntegration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { instanceOid: 10n, magicMcpServerOid: 20n, isManaged: false },
        orderBy: { createdAt: 'asc' }
      })
    );
    expect(db.consumerActor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ consumerProfileOid: 30n })
      })
    );
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'magic_server',
          identityActorId: 'actor_consumer',
          identityId: 'identity_consumer'
        })
      })
    );
  });

  it('uses the oldest managed link as the owner of consumer-deployed servers', async () => {
    vi.mocked(db.consumerIntegration.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ consumerProfileOid: 31n } as any);
    vi.mocked(db.consumerActor.findFirst).mockResolvedValue({
      id: 'actor_deployer',
      defaultIdentityId: 'identity_deployer'
    } as any);

    await ensureMagicMcpServerBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      server: createServer({ oid: 21n, id: 'deployed_server' })
    });

    expect(db.consumerIntegration.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { instanceOid: 10n, magicMcpServerOid: 21n, isManaged: true }
      })
    );
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'deployed_server',
          identityActorId: 'actor_deployer',
          identityId: 'identity_deployer'
        })
      })
    );
  });

  it('ignores managed links on servers a consumer did not deploy', async () => {
    vi.mocked(db.consumerIntegration.findFirst).mockResolvedValue(null);

    await ensureMagicMcpServerBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      server: createServer({ oid: 22n, id: 'shared_server', source: 'manual' })
    });

    expect(db.consumerIntegration.findFirst).toHaveBeenCalledTimes(1);
    expect(db.consumerActor.findFirst).not.toHaveBeenCalled();

    let input = vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking).mock
      .calls[0]![0].input;
    expect(input.identityActorId).toBeUndefined();
    expect(input.identityId).toBeUndefined();
  });

  it('keeps endpoint consumer identity off member server backings', async () => {
    vi.mocked(db.consumerIntegration.findFirst).mockResolvedValue(null);
    vi.mocked(db.consumerActor.findFirst).mockResolvedValue({
      id: 'actor_endpoint',
      defaultIdentityId: 'identity_endpoint'
    } as any);

    let endpoint = {
      oid: 40n,
      id: 'magic_endpoint',
      consumerProfileOid: 30n,
      name: 'Consumer endpoint',
      description: null,
      metadata: {},
      servers: [
        {
          id: 'mgep_backed',
          toolFilters: null,
          magicMcpServer: createServer({
            oid: 50n,
            id: 'backed_server',
            source: 'manual',
            hasSubspaceBacking: true
          })
        },
        {
          id: 'mgep_unbacked',
          toolFilters: null,
          magicMcpServer: createServer({
            oid: 51n,
            id: 'unbacked_server',
            source: 'manual',
            hasSubspaceBacking: false
          })
        }
      ]
    } as any;
    vi.mocked(db.magicMcpEndpoint.findUniqueOrThrow).mockResolvedValue(endpoint);
    vi.mocked(db.magicMcpServer.findUniqueOrThrow).mockResolvedValue(
      endpoint.servers[1].magicMcpServer
    );

    await ensureMagicMcpEndpointBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      endpoint
    });

    let serverUpserts = vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking)
      .mock.calls;
    expect(serverUpserts).toHaveLength(1);
    expect(serverUpserts[0]![0].input.id).toBe('unbacked_server');
    expect(serverUpserts[0]![0].input.identityActorId).toBeUndefined();
    expect(serverUpserts[0]![0].input.identityId).toBeUndefined();

    expect(magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'magic_endpoint',
          identityActorId: 'actor_endpoint',
          identityId: 'identity_endpoint',
          servers: [
            {
              id: 'mgep_backed',
              magicMcpServerBackingId: 'backed_server',
              toolFilters: null
            },
            {
              id: 'mgep_unbacked',
              magicMcpServerBackingId: 'unbacked_server',
              toolFilters: null
            }
          ]
        })
      })
    );
  });

  let createEndpointWithUnbackedServers = (serverOids: bigint[]) =>
    ({
      oid: 41n,
      id: 'shared_endpoint',
      consumerProfileOid: null,
      name: 'Shared endpoint',
      description: null,
      metadata: {},
      servers: serverOids.map(oid => ({
        id: `mgep_${oid}`,
        toolFilters: null,
        magicMcpServer: createServer({ oid, id: `server_${oid}`, source: 'manual' })
      }))
    }) as any;

  it('skips member servers another worker backed in the meantime', async () => {
    vi.mocked(db.consumerIntegration.findFirst).mockResolvedValue(null);
    let endpoint = createEndpointWithUnbackedServers([60n, 61n]);
    vi.mocked(db.magicMcpEndpoint.findUniqueOrThrow).mockResolvedValue(endpoint);
    vi.mocked(db.magicMcpServer.findUniqueOrThrow).mockImplementation((async (args: any) =>
      createServer({
        oid: args.where.oid,
        id: `server_${args.where.oid}`,
        source: 'manual',
        hasSubspaceBacking: args.where.oid === 60n
      })) as any);

    await ensureMagicMcpEndpointBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      endpoint
    });

    let serverUpserts = vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking)
      .mock.calls;
    expect(serverUpserts.map(call => call[0].input.id)).toEqual(['server_61']);
    expect(
      magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking
    ).toHaveBeenCalledOnce();
  });

  it('backs member servers one at a time', async () => {
    vi.mocked(db.consumerIntegration.findFirst).mockResolvedValue(null);
    let endpoint = createEndpointWithUnbackedServers([70n, 71n, 72n]);
    vi.mocked(db.magicMcpEndpoint.findUniqueOrThrow).mockResolvedValue(endpoint);
    vi.mocked(db.magicMcpServer.findUniqueOrThrow).mockImplementation((async (args: any) =>
      createServer({
        oid: args.where.oid,
        id: `server_${args.where.oid}`,
        source: 'manual'
      })) as any);

    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking).mockImplementation(
      (async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(resolve => setTimeout(resolve, 5));
        inFlight--;

        return {
          ownerType: 'server_owned',
          ephemeralManagedSession: { id: 'ems_server', isReconciling: false }
        };
      }) as any
    );

    await ensureMagicMcpEndpointBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      endpoint
    });

    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
  });
});
