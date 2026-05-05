import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => {
  let db = {
    project: {
      findUniqueOrThrow: vi.fn()
    },
    magicMcpSession: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn()
    }
  };

  return {
    db,
    ID: {
      generateId: vi.fn().mockResolvedValue('magic-session-link-1')
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
  };
});

vi.mock('../src/services', () => ({
  magicMcpEndpointInclude: {}
}));

vi.mock('../src/services/magicMcpServer', () => ({
  getMagicMcpServerSessionTemplateId: vi.fn(
    server => server.newSubspaceSessionTemplateId ?? server.legacySubspaceSessionTemplateId ?? null
  ),
  ensureMagicMcpServerBacking: vi.fn(async ({ server }) => ({
    ...server,
    hasSubspaceBacking: true,
    newSubspaceSessionTemplateId: server.newSubspaceSessionTemplateId ?? 'tmpl_1',
    subspaceEphemeralManagedSessionId:
      server.subspaceEphemeralManagedSessionId ?? 'ephemeral_managed_session_1'
  }))
}));

vi.mock('../src/services/magicMcpEndpoint', () => ({
  getMagicMcpEndpointSessionTemplateId: vi.fn(
    endpoint =>
      endpoint.newSubspaceSessionTemplateId ?? endpoint.legacySubspaceSessionTemplateId ?? null
  ),
  ensureMagicMcpEndpointBacking: vi.fn(async ({ endpoint }) => ({
    ...endpoint,
    hasSubspaceBacking: true,
    newSubspaceSessionTemplateId: endpoint.newSubspaceSessionTemplateId ?? 'tmpl_endpoint_1',
    subspaceEphemeralManagedSessionId:
      endpoint.subspaceEphemeralManagedSessionId ?? 'ephemeral_managed_endpoint_1'
  })),
  magicMcpEndpointInclude: {}
}));

import { db } from '@metorial/db';
import {
  ensureMagicMcpSubspaceSession,
  syncMagicMcpSubspaceSession
} from '../src/lib/ensureSession';
import { ensureMagicMcpServerBacking } from '../src/services/magicMcpServer';

describe('syncMagicMcpSubspaceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('reuses a non-expired mapping', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T10:00:00.000Z'));

    let mapping = {
      oid: 1n,
      subspaceSessionId: 'ses_existing',
      subspaceSessionTemplateId: 'tmpl_1',
      expiresAt: new Date('2026-04-25T12:00:00.000Z')
    };

    vi.mocked(db.magicMcpSession.findUnique).mockResolvedValue(mapping as any);

    let result = await syncMagicMcpSubspaceSession(
      {
        type: 'server',
        target: {
          oid: 10n,
          id: 'mcp_server_1',
          name: 'Claude',
          description: 'Magic MCP server',
          newSubspaceSessionTemplateId: 'tmpl_1',
          instance: {
            oid: 20n,
            id: 'ins_1',
            projectOid: 30n
          }
        } as any
      },
      'ses_existing'
    );

    expect(result).toBe(mapping);
    expect(db.project.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('updates an expired mapping using the concrete subspace session id', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T09:15:00.000Z'));

    let existingMapping = {
      oid: 1n,
      subspaceSessionId: 'ses_old',
      subspaceSessionTemplateId: 'tmpl_1',
      expiresAt: new Date('2026-04-24T08:00:00.000Z')
    };
    let nextMapping = {
      ...existingMapping,
      subspaceSessionId: 'ses_new',
      expiresAt: new Date('2026-04-24T10:15:00.000Z')
    };

    vi.mocked(db.magicMcpSession.findUnique).mockResolvedValue(existingMapping as any);
    vi.mocked(db.magicMcpSession.upsert).mockResolvedValue(nextMapping as any);
    vi.mocked(db.project.findUniqueOrThrow).mockResolvedValue({
      magicMcpSessionDurationMinutes: 60
    } as any);
    let result = await syncMagicMcpSubspaceSession(
      {
        type: 'server',
        target: {
          oid: 10n,
          id: 'mcp_server_1',
          name: 'Claude',
          description: 'Magic MCP server',
          newSubspaceSessionTemplateId: 'tmpl_1',
          instance: {
            oid: 20n,
            id: 'ins_1',
            projectOid: 30n
          }
        } as any
      },
      'ses_new'
    );

    expect(db.magicMcpSession.upsert).toHaveBeenCalledWith({
      where: {
        magicMcpServerOid: 10n
      },
      update: {
        subspaceSessionId: 'ses_new',
        subspaceSessionTemplateId: 'tmpl_1',
        expiresAt: new Date('2026-04-24T10:15:00.000Z'),
        isActive: true,
        isConsumerReconciled: true
      },
      create: {
        id: 'magic-session-link-1',
        instanceOid: 20n,
        magicMcpServerOid: 10n,
        subspaceSessionId: 'ses_new',
        subspaceSessionTemplateId: 'tmpl_1',
        expiresAt: new Date('2026-04-24T10:15:00.000Z'),
        isActive: true,
        isConsumerReconciled: true
      }
    });
    expect(result).toEqual(nextMapping);
  });
});

describe('ensureMagicMcpSubspaceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('lazily ensures backing and returns the ephemeral managed session id', async () => {
    let target = {
      type: 'server' as const,
      target: {
        oid: 10n,
        id: 'mcp_server_1',
        name: 'Claude',
        description: 'Magic MCP server',
        hasSubspaceBacking: false,
        legacySubspaceSessionTemplateId: 'tmpl_1',
        subspaceEphemeralManagedSessionId: null,
        instance: {
          oid: 20n,
          id: 'ins_1',
          projectOid: 30n
        }
      } as any
    };

    let result = await ensureMagicMcpSubspaceSession(target);

    expect(result).toBe('ephemeral_managed_session_1');
    expect(ensureMagicMcpServerBacking).toHaveBeenCalledWith({
      instance: expect.objectContaining({ id: 'ins_1' }),
      server: target.target
    });
    expect(target.target.subspaceEphemeralManagedSessionId).toBe(
      'ephemeral_managed_session_1'
    );
  });
});
