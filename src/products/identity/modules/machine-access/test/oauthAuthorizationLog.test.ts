import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    oAuthAuthorizationFlow: {
      findMany: vi.fn()
    },
    organizationMember: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: mockDb
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_: string, factory: any) => ({
      build: () => factory()
    })
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (factory: any) => factory({ prisma: (cb: any) => cb({}) })
  }
}));

import { oauthAuthorizationLogService } from '../src/services/oauthAuthorizationLog';

let baseOrg = { oid: 1n, id: 'org_1' } as any;

describe('oauthAuthorizationLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.oAuthAuthorizationFlow.findMany.mockResolvedValue([]);
    mockDb.organizationMember.findMany.mockResolvedValue([]);
  });

  it('filters only internal oauth apps out of authorization logs', async () => {
    await oauthAuthorizationLogService.listOAuthAuthorizationLogs({
      organization: baseOrg,
      oauthApplicationIds: ['oauth_app_1']
    });

    expect(mockDb.oAuthAuthorizationFlow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationOid: baseOrg.oid,
          oauthApplication: {
            id: {
              in: ['oauth_app_1']
            },
            type: {
              not: 'internal'
            }
          }
        })
      })
    );
  });
});
