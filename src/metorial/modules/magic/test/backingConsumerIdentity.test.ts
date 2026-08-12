import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => {
  let db = {
    project: {
      findUniqueOrThrow: vi.fn()
    },
    consumerActor: {
      findFirst: vi.fn()
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

  it('passes managed consumer actor and identity ids to server backings', async () => {
    vi.mocked(db.consumerIntegration.findFirst).mockResolvedValue({
      consumerProfileOid: 30n
    } as any);
    vi.mocked(db.consumerActor.findFirst).mockResolvedValue({
      id: 'actor_consumer',
      defaultIdentityId: 'identity_consumer'
    } as any);

    let server = {
      oid: 20n,
      id: 'magic_server',
      providerTemplateId: null,
      subspaceIntegrationInstanceId: null,
      name: 'Consumer server',
      description: null,
      metadata: {},
      legacySubspaceSessionTemplateId: null
    } as any;

    await ensureMagicMcpServerBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      server
    });

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

  it('passes endpoint consumer identity to endpoint and linked server backings', async () => {
    vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue([]);
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
          id: 'endpoint_server_join',
          toolFilters: null,
          magicMcpServer: {
            oid: 50n,
            id: 'linked_server',
            providerTemplateId: null,
            subspaceIntegrationInstanceId: null,
            name: 'Linked server',
            description: null,
            metadata: {},
            legacySubspaceSessionTemplateId: null
          }
        }
      ]
    } as any;
    vi.mocked(db.magicMcpEndpoint.findUniqueOrThrow).mockResolvedValue(endpoint);

    await ensureMagicMcpEndpointBacking({
      instance: { oid: 10n, projectOid: 11n } as any,
      endpoint
    });

    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'linked_server',
          identityActorId: 'actor_endpoint',
          identityId: 'identity_endpoint'
        })
      })
    );
    expect(magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'magic_endpoint',
          identityActorId: 'actor_endpoint',
          identityId: 'identity_endpoint'
        })
      })
    );
  });
});
