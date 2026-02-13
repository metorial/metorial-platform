process.env.REDIS_URL = 'redis://localhost:6379';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '@metorial/error';

vi.mock('@metorial/db', () => ({
  db: {
    organization: {
      findFirstOrThrow: vi.fn()
    },
    magicMcpServerSubspaceSession: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    magicMcpServer: {
      findMany: vi.fn()
    }
  },
  ensureEmailIdentity: vi.fn(fn => fn)
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    getAccessTagFilter: vi.fn(async () => ({ some: true }))
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceSessionService: {
    get: vi.fn()
  },
  subspaceSessionConnectionService: {
    list: vi.fn()
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

import { db } from '@metorial/db';
import {
  subspaceSessionConnectionService,
  subspaceSessionService
} from '@metorial/module-subspace';
import { magicMcpSessionService } from '../src/services/magicMcpSession';

let instance = {
  oid: 11n,
  id: 'ins_1',
  organizationOid: 101n
} as const;

let mappingRow = {
  oid: 501n,
  id: 'mgss_501',
  instanceOid: 11n,
  magicMcpServerOid: 301n,
  subspaceSessionId: 'ses_subspace_1',
  subspaceSessionTemplateId: 'stpl_1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:05:00.000Z'),
  magicMcpServer: {
    oid: 301n,
    id: 'mgsr_301',
    status: 'active',
    name: 'Portal Server',
    description: null,
    metadata: {},
    instanceOid: 11n,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    consumerProfileOid: null,
    subspaceSessionTemplateId: 'stpl_1',
    subspaceTenantId: 'tenant_1',
    subspaceEnvironmentId: 'env_1'
  }
};

describe('magicMcpSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.organization.findFirstOrThrow).mockResolvedValue({
      oid: 101n,
      id: 'org_1'
    } as never);
  });

  it('hydrates mapping rows with subspace session state and connection count', async () => {
    vi.mocked(db.magicMcpServerSubspaceSession.findFirst).mockResolvedValue(mappingRow as never);
    vi.mocked(subspaceSessionService.get).mockResolvedValue({
      id: 'ses_subspace_1',
      connectionState: 'connected',
      usage: {
        totalProductiveClientMessageCount: 2,
        totalProductiveServerMessageCount: 3
      },
      createdAt: mappingRow.createdAt,
      updatedAt: mappingRow.updatedAt,
      lastActiveAt: new Date('2026-01-01T00:04:00.000Z')
    } as never);
    vi.mocked(subspaceSessionConnectionService.list).mockResolvedValue({
      items: [{ id: 'conn_1' }, { id: 'conn_2' }]
    } as never);

    let result = await magicMcpSessionService.getMagicMcpSessionById({
      instance: instance as never,
      magicMcpSessionId: 'mgss_501'
    });

    expect(result.subspaceSession.id).toBe('ses_subspace_1');
    expect(result.subspaceSession.connectionState).toBe('connected');
    expect(result.connectionCount).toBe(2);
    expect(db.magicMcpServerSubspaceSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'mgss_501',
          instanceOid: 11n
        })
      })
    );
  });

  it('uses disconnected fallback when subspace calls fail', async () => {
    vi.mocked(db.magicMcpServerSubspaceSession.findFirst).mockResolvedValue(mappingRow as never);
    vi.mocked(subspaceSessionService.get).mockRejectedValue(new Error('subspace unavailable'));
    vi.mocked(subspaceSessionConnectionService.list).mockRejectedValue(new Error('subspace unavailable'));

    let result = await magicMcpSessionService.getMagicMcpSessionById({
      instance: instance as never,
      magicMcpSessionId: 'mgss_501'
    });

    expect(result.subspaceSession.id).toBe('ses_subspace_1');
    expect(result.subspaceSession.connectionState).toBe('disconnected');
    expect(result.connectionCount).toBe(0);
  });

  it('filters list queries by magic server ids via mapping table', async () => {
    vi.mocked(db.magicMcpServer.findMany).mockResolvedValue([{ oid: 301n }] as never);
    vi.mocked(db.magicMcpServerSubspaceSession.findMany).mockResolvedValue([] as never);

    await magicMcpSessionService.listMagicMcpSessions({
      instance: instance as never,
      magicMcpServerId: ['mgsr_301']
    });

    expect(db.magicMcpServer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['mgsr_301'] }, instanceOid: 11n },
      select: { oid: true }
    });
    expect(db.magicMcpServerSubspaceSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instanceOid: 11n,
          AND: expect.arrayContaining([{ magicMcpServerOid: { in: [301n] } }])
        })
      })
    );
  });

  it('throws not found when mapping row does not exist', async () => {
    vi.mocked(db.magicMcpServerSubspaceSession.findFirst).mockResolvedValue(null);

    await expect(
      magicMcpSessionService.getMagicMcpSessionById({
        instance: instance as never,
        magicMcpSessionId: 'missing'
      })
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
