import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    consumerActor: {
      findFirst: vi.fn()
    },
    magicMcpSession: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    getAccessTagFilter: vi.fn()
  },
  consumerMagicMcpReadRoles: ['consumer#instance.magic_mcp:read']
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

import { db } from '@metorial/db';
import { accessTagService } from '@metorial/module-access';
import { consumerActivityScopeService } from '../src/services/consumerEntities/consumerActivityScope';

describe('consumerActivityScopeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves only the current profile actor and accessible Magic MCP sessions', async () => {
    (db.consumerActor.findFirst as any).mockResolvedValue({
      id: 'coa_current',
      isDefault: true
    });
    (accessTagService.getAccessTagFilter as any).mockResolvedValue({
      some: {
        accessTagOid: { in: [30n] }
      }
    });
    (db.magicMcpSession.findMany as any).mockResolvedValue([
      {
        id: 'mms_1',
        subspaceSessionId: 'ses_1',
        magicMcpEndpoint: {
          id: 'mep_1',
          oid: 40n,
          consumerProfileOid: 20n
        }
      }
    ]);

    let scope = await consumerActivityScopeService.resolve({
      instance: { oid: 10n } as any,
      consumerProfile: {
        oid: 20n,
        instanceOid: 10n
      },
      accessTags: [30n]
    });

    expect(db.consumerActor.findFirst).toHaveBeenCalledWith({
      where: {
        instanceOid: 10n,
        consumerProfileOid: 20n,
        isDefault: true
      }
    });
    expect(db.magicMcpSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instanceOid: 10n,
          OR: expect.arrayContaining([
            {
              magicMcpEndpoint: {
                status: 'active',
                consumerProfileOid: 20n
              }
            },
            {
              consumerIntegrationSessions: {
                some: {
                  consumerProfileOid: 20n
                }
              }
            }
          ])
        })
      })
    );
    expect(scope.consumerActor.id).toBe('coa_current');
    expect(scope.subspaceSessionIds).toEqual(['ses_1']);
  });

  it('rejects a profile from another instance before querying activity', async () => {
    await expect(
      consumerActivityScopeService.resolve({
        instance: { oid: 10n } as any,
        consumerProfile: {
          oid: 20n,
          instanceOid: 11n
        },
        accessTags: [30n]
      })
    ).rejects.toBeDefined();

    expect(db.consumerActor.findFirst).not.toHaveBeenCalled();
    expect(db.magicMcpSession.findMany).not.toHaveBeenCalled();
  });
});
