import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => {
  let db = {
    project: {
      findUniqueOrThrow: vi.fn()
    },
    magicMcpSession: {
      findUnique: vi.fn(),
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

import { db } from '@metorial/db';
import { syncMagicMcpSubspaceSession } from '../src/lib/ensureSession';

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
          subspaceSessionTemplateId: 'tmpl_1',
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

    vi.mocked(db.magicMcpSession.findUnique)
      .mockResolvedValueOnce(existingMapping as any)
      .mockResolvedValueOnce(nextMapping as any);
    vi.mocked(db.magicMcpSession.updateMany).mockResolvedValue({
      count: 1
    } as any);
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
          subspaceSessionTemplateId: 'tmpl_1',
          instance: {
            oid: 20n,
            id: 'ins_1',
            projectOid: 30n
          }
        } as any
      },
      'ses_new'
    );

    expect(db.magicMcpSession.updateMany).toHaveBeenCalledWith({
      where: {
        oid: 1n,
        subspaceSessionId: 'ses_old'
      },
      data: {
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
