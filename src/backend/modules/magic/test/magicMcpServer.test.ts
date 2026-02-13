process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CONSUMER_TOKEN_SECRET = 'test-secret-token-for-testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '@metorial/error';

vi.mock('@metorial/db', () => {
  let db = {
    magicMcpServer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirstOrThrow: vi.fn()
    },
    magicMcpServerSubspaceSession: {
      delete: vi.fn(async () => null)
    },
    magicMcpGroup: {
      findMany: vi.fn()
    },
    instance: {
      findUnique: vi.fn()
    }
  };

  return {
    db,
    ID: {
      generateId: vi.fn().mockResolvedValue('mgsr_test_1')
    },
    withTransaction: vi.fn(async fn => fn(db)),
    ensureEmailIdentity: vi.fn(fn => fn)
  };
});

vi.mock('@metorial/id', () => ({
  generateCode: vi.fn().mockReturnValue('abc12'),
  generatePlainId: vi.fn().mockReturnValue('plainid12')
}));

vi.mock('@metorial/slugify', () => ({
  slugify: vi.fn((str: string) => str.toLowerCase().replace(/\s+/g, '-'))
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    checkResourceAccess: vi.fn(async () => {}),
    getAccessTagFilter: vi.fn(async () => ({ some: true })),
    linkAccessTagToEntity: vi.fn(async () => ({ create: [] }))
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    search: vi.fn()
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(
      (fn: (ctx: { prisma: (cb: (opts: object) => Promise<unknown>) => Promise<unknown> }) => unknown) =>
        fn({
          prisma: async cb => cb({})
        })
    )
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(async () => {}),
    process: vi.fn((fn: unknown) => fn)
  })),
  combineQueueProcessors: vi.fn(() => ({}))
}));

vi.mock('../src/services/magicMcpSubspaceSession', () => ({
  magicMcpSubspaceSessionService: {
    cleanupSessionForTemplateChange: vi.fn(async () => {})
  }
}));

import { db, withTransaction } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { magicMcpServerService } from '../src/services/magicMcpServer';
import { magicMcpSubspaceSessionService } from '../src/services/magicMcpSubspaceSession';

let mockInstance = {
  oid: 11n,
  id: 'ins_test_1',
  subspaceTenantId: 'tenant_1',
  subspaceEnvironmentId: 'env_1'
} as const;

describe('magicMcpServerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a magic server with subspaceSessionTemplateId', async () => {
    let created = {
      id: 'mgsr_test_1',
      status: 'active',
      aliases: [{ oid: 1n, slug: 'portal-github-abc12' }],
      subspaceSession: null
    };
    let createSpy = vi.fn().mockResolvedValue(created);

    vi.mocked(withTransaction).mockImplementation(async fn =>
      fn({
        magicMcpServer: {
          create: createSpy
        }
      } as unknown as Parameters<typeof fn>[0])
    );

    await magicMcpServerService.createMagicMcpServer({
      organization: { oid: 101n } as never,
      performedBy: { oid: 201n } as never,
      instance: mockInstance as never,
      context: {} as never,
      input: {
        name: 'Portal GitHub',
        sessionTemplateId: 'stpl_123',
        metadata: { origin: 'test' }
      }
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subspaceSessionTemplateId: 'stpl_123'
        })
      })
    );
  });

  it('archives previous mapping and triggers cleanup when session template changes', async () => {
    vi.mocked(db.magicMcpServer.update).mockResolvedValue({
      oid: 301n,
      id: 'mgsr_301',
      instanceOid: 11n,
      subspaceSessionTemplateId: 'stpl_new',
      aliases: [],
      subspaceSession: {
        oid: 999n,
        id: 'mgss_1',
        subspaceSessionId: 'ses_old',
        subspaceSessionTemplateId: 'stpl_old',
        instanceOid: 11n,
        magicMcpServerOid: 301n,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } as never);

    vi.mocked(db.instance.findUnique).mockResolvedValue({
      oid: 11n,
      id: 'ins_test_1',
      organizationOid: 101n,
      organization: { oid: 101n, id: 'org_1' }
    } as never);

    vi.mocked(db.magicMcpServer.findFirstOrThrow).mockResolvedValue({
      oid: 301n,
      id: 'mgsr_301',
      subspaceSessionTemplateId: 'stpl_new',
      aliases: [],
      subspaceSession: null
    } as never);

    await magicMcpServerService.updateMagicMcpServer({
      server: {
        oid: 301n,
        id: 'mgsr_301',
        instanceOid: 11n,
        status: 'active',
        name: 'Server',
        description: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        consumerProfileOid: null,
        subspaceSessionTemplateId: 'stpl_old',
        subspaceTenantId: 'tenant_1',
        subspaceEnvironmentId: 'env_1',
        aliases: [],
        subspaceSession: {
          oid: 999n,
          id: 'mgss_1',
          subspaceSessionId: 'ses_old',
          subspaceSessionTemplateId: 'stpl_old',
          instanceOid: 11n,
          magicMcpServerOid: 301n,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      input: {
        sessionTemplateId: 'stpl_new'
      }
    });

    expect(db.magicMcpServerSubspaceSession.delete).toHaveBeenCalledWith({
      where: { magicMcpServerOid: 301n }
    });
    expect(magicMcpSubspaceSessionService.cleanupSessionForTemplateChange).toHaveBeenCalledWith({
      instance: expect.objectContaining({ oid: 11n }),
      organization: expect.objectContaining({ oid: 101n }),
      subspaceSessionId: 'ses_old',
      replacementSessionTemplateId: 'stpl_new'
    });
  });

  it('uses search ids in list query filters', async () => {
    vi.mocked(searchService.search).mockResolvedValue([{ id: 'mgsr_a' }, { id: 'mgsr_b' }] as never);
    vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([] as never);

    await magicMcpServerService.listMagicMcpServers({
      instance: mockInstance as never,
      search: 'github'
    });

    expect(searchService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'magic_mcp_server',
        query: 'github'
      })
    );
    expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['mgsr_a', 'mgsr_b'] }
        })
      })
    );
  });

  it('rejects updates for non-active servers', async () => {
    await expect(
      magicMcpServerService.updateMagicMcpServer({
        server: {
          oid: 401n,
          id: 'mgsr_401',
          instanceOid: 11n,
          status: 'archived',
          name: null,
          description: null,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          consumerProfileOid: null,
          subspaceSessionTemplateId: 'stpl_1',
          subspaceTenantId: 'tenant_1',
          subspaceEnvironmentId: 'env_1',
          aliases: [],
          subspaceSession: null
        },
        input: { name: 'new name' }
      })
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
