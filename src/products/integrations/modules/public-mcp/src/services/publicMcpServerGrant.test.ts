import { assertNotPublicMcpOwned } from '@metorial-subspace/public-mcp-guard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  grantFindUniqueOrThrow: vi.fn(),
  grantUpdateMany: vi.fn(),
  sessionFindUniqueOrThrow: vi.fn(),
  sessionUpdateMany: vi.fn(),
  sessionProviderUpdateMany: vi.fn(),
  createSessionInternal: vi.fn(),
  archiveSessionInternal: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    publicMcpServerGrant: {
      findUniqueOrThrow: mocks.grantFindUniqueOrThrow,
      updateMany: mocks.grantUpdateMany
    },
    session: {
      findUniqueOrThrow: mocks.sessionFindUniqueOrThrow,
      updateMany: mocks.sessionUpdateMany
    },
    sessionProvider: { updateMany: mocks.sessionProviderUpdateMany }
  };

  return {
    db,
    getId: vi.fn(),
    addAfterTransactionHook: vi.fn(),
    withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) => run(db))
  };
});

vi.mock('@metorial-subspace/list-utils', () => ({ normalizeDateFilter: vi.fn() }));

vi.mock('@metorial-subspace/module-session', () => ({
  sessionService: {
    createSessionInternal: mocks.createSessionInternal,
    archiveSessionInternal: mocks.archiveSessionInternal
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getSubspaceSystemProviderEventBase: vi.fn(),
  resolveMetorialFacing: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));

vi.mock('../internal/rateLimit', () => ({
  assertPublicMcpRateLimit: vi.fn(async () => {})
}));

vi.mock('../queues/grantCleanup', () => ({
  publicMcpGrantCleanupQueue: { add: vi.fn() }
}));

import { publicMcpServerGrantService } from './publicMcpServerGrant';

describe('publicMcpServerGrantService.ensureGrantSession', () => {
  let grantRow = {
    oid: 5n,
    id: 'grant_1',
    publicMcpServerOid: 7n,
    configOid: 11n,
    authConfigOid: 12n,
    currentSessionOid: null,
    currentSession: null,
    tenant: { oid: 1n },
    environment: { oid: 2n },
    deployment: { id: 'dep_1' },
    config: { id: 'cfg_1' },
    authConfig: { id: 'auth_1' },
    publicMcpServer: { id: 'pms_1', name: 'Linear', toolFilter: null }
  };

  beforeEach(() => {
    for (let mock of Object.values(mocks)) mock.mockReset();

    mocks.grantFindUniqueOrThrow.mockResolvedValue(grantRow);
    mocks.createSessionInternal.mockResolvedValue({ oid: 100n });
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sessionProviderUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('archives the orphaned session under a scope that includes it when the claim race is lost', async () => {
    let orphan = { oid: 100n, ownerPublicMcpServerOid: 7n };
    let winner = { oid: 101n, status: 'active' };

    mocks.grantUpdateMany.mockResolvedValue({ count: 0 });
    mocks.sessionFindUniqueOrThrow.mockResolvedValue(orphan);
    mocks.archiveSessionInternal.mockImplementation(async () => {
      assertNotPublicMcpOwned(orphan, 'session');
    });
    mocks.grantFindUniqueOrThrow
      .mockResolvedValueOnce(grantRow)
      .mockResolvedValueOnce({ ...grantRow, currentSession: winner });

    let result = await publicMcpServerGrantService.ensureGrantSession({
      grant: grantRow as any
    });

    expect(mocks.archiveSessionInternal).toHaveBeenCalledTimes(1);
    expect(result).toBe(winner);
  });

  it('returns the claimed session without archiving anything when the claim succeeds', async () => {
    let created = { oid: 100n, status: 'active' };

    mocks.grantUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sessionFindUniqueOrThrow.mockResolvedValue(created);

    let result = await publicMcpServerGrantService.ensureGrantSession({
      grant: grantRow as any
    });

    expect(result).toBe(created);
    expect(mocks.archiveSessionInternal).not.toHaveBeenCalled();
  });
});
