import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    project: {
      findUniqueOrThrow: vi.fn()
    },
    providerTemplate: {
      findFirst: vi.fn()
    },
    magicMcpServer: {
      update: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(code: string) {
        super(code);
        this.code = code;
      }
    }
  }
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    checkResourceAccess: vi.fn(),
    getAccessTagFilter: vi.fn()
  },
  consumerMagicMcpReadRoles: [],
  consumerMagicMcpWriteRoles: []
}));

vi.mock('@metorial/module-search', () => ({
  searchMagicMcpServerIds: vi.fn()
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceMagicMcpBackingService: {
    upsertProviderTemplate: vi.fn(),
    upsertServer: vi.fn(),
    archiveServer: vi.fn()
  },
  subspaceMagicMcpServerProviderService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  subspaceSessionTemplateProviderService: {
    list: vi.fn()
  },
  subspaceSessionTemplateService: {
    listTools: vi.fn()
  }
}));

vi.mock('../src/queues/lifecycle/magicMcpServer', () => ({
  magicMcpServerCreatedQueue: { add: vi.fn() },
  magicMcpServerUpdatedQueue: { add: vi.fn() },
  magicMcpServerDeletedQueue: { add: vi.fn() }
}));

import { db } from '@metorial/db';
import {
  subspaceMagicMcpBackingService,
  subspaceSessionTemplateProviderService
} from '@metorial/module-subspace';
import { ensureMagicMcpServerBacking } from '../src/services/magicMcpServer';

describe('ensureMagicMcpServerBacking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies provider setup from the legacy session template and preserves the legacy id', async () => {
    vi.mocked(db.project.findUniqueOrThrow).mockResolvedValue({
      magicMcpSessionDurationMinutes: 60
    } as any);
    vi.mocked(subspaceSessionTemplateProviderService.list).mockResolvedValue({
      run: vi.fn().mockResolvedValue({
        items: [
          {
            deployment: { id: 'deployment-1' },
            config: { id: 'config-1' },
            authConfig: { id: 'auth-1' },
            toolFilter: { type: 'v1.filter', filters: [] }
          },
          {
            deployment: { id: 'deployment-2' },
            config: null,
            authConfig: null,
            toolFilter: null
          }
        ]
      })
    } as any);
    vi.mocked(subspaceMagicMcpBackingService.upsertServer).mockResolvedValue({
      sessionTemplateId: 'template-new',
      ephemeralManagedSessionId: 'session-new'
    } as any);
    vi.mocked(db.magicMcpServer.update).mockResolvedValue({
      id: 'server-1',
      legacySubspaceSessionTemplateId: 'template-legacy',
      newSubspaceSessionTemplateId: 'template-new',
      subspaceEphemeralManagedSessionId: 'session-new'
    } as any);

    await ensureMagicMcpServerBacking({
      instance: {
        oid: 99n,
        projectOid: 100n
      } as any,
      server: {
        oid: 1n,
        id: 'server-1',
        ownerType: 'server_owned',
        providerTemplateId: null,
        subspaceOwnerIntegrationId: null,
        hasSubspaceBacking: true,
        legacySubspaceSessionTemplateId: 'template-legacy',
        newSubspaceSessionTemplateId: null,
        subspaceEphemeralManagedSessionId: null,
        name: 'Legacy Server',
        description: 'Migrated from legacy template',
        metadata: {}
      } as any
    });

    expect(subspaceSessionTemplateProviderService.list).toHaveBeenCalledWith({
      instance: expect.objectContaining({ oid: 99n }),
      allowDeleted: false,
      status: ['active'],
      sessionTemplateIds: ['template-legacy']
    });
    expect(subspaceMagicMcpBackingService.upsertServer).toHaveBeenCalledWith({
      instance: expect.objectContaining({ oid: 99n }),
      magicMcpServerBackingId: 'server-1',
      providerTemplateBackingId: null,
      ownerIntegrationId: null,
      name: 'Legacy Server',
      description: 'Migrated from legacy template',
      metadata: {},
      maxSessionDurationInMinutes: 60,
      providers: [
        {
          providerDeploymentId: 'deployment-1',
          providerConfigId: 'config-1',
          providerAuthConfigId: 'auth-1',
          toolFilters: { type: 'v1.filter', filters: [] }
        },
        {
          providerDeploymentId: 'deployment-2',
          providerConfigId: null,
          providerAuthConfigId: null,
          toolFilters: null
        }
      ]
    });
    expect(db.magicMcpServer.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        hasSubspaceBacking: true,
        ownerType: 'server_owned',
        providerTemplateId: null,
        subspaceOwnerIntegrationId: null,
        newSubspaceSessionTemplateId: 'template-new',
        subspaceEphemeralManagedSessionId: 'session-new'
      }
    });
  });
});
