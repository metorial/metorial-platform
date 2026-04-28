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

vi.mock('@metorial/module-subspace', () => ({
  subspaceSessionService: {
    create: vi.fn(),
    delete: vi.fn()
  },
  subspaceSessionTemplateProviderService: {
    getMany: vi.fn()
  },
  subspaceSessionTemplateService: {
    create: vi.fn()
  }
}));

vi.mock('../src/services', () => ({
  magicMcpEndpointInclude: {}
}));

import { db } from '@metorial/db';
import {
  subspaceSessionService,
  subspaceSessionTemplateProviderService
} from '@metorial/module-subspace';
import { ensureMagicMcpSubspaceSession } from '../src/lib/ensureSession';

describe('ensureMagicMcpSubspaceSession', () => {
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

    let result = await ensureMagicMcpSubspaceSession({
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
    });

    expect(result).toBe(mapping);
    expect(subspaceSessionTemplateProviderService.getMany).not.toHaveBeenCalled();
    expect(subspaceSessionService.create).not.toHaveBeenCalled();
  });

  it('rotates an expired mapping using the project duration and a friendly name', async () => {
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
    vi.mocked(subspaceSessionTemplateProviderService.getMany).mockResolvedValue([]);
    vi.mocked(subspaceSessionService.create).mockResolvedValue({
      id: 'ses_new',
      providers: []
    } as any);
    vi.mocked(subspaceSessionService.delete).mockResolvedValue({} as any);

    let result = await ensureMagicMcpSubspaceSession({
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
    });

    expect(subspaceSessionService.create).toHaveBeenCalledWith({
      instance: expect.objectContaining({ id: 'ins_1' }),
      name: 'Magic MCP Claude - 2026-04-24',
      description: 'Magic MCP server',
      providers: []
    });
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
