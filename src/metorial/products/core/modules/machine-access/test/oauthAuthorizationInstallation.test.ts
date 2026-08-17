import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    oAuthInstallation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    oAuthAuthorization: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: mockDb,
  withTransaction: (fn: any) => fn(mockDb),
  addAfterTransactionHook: vi.fn((hook: any) => hook()),
  ID: {
    generateId: vi.fn(async (prefix: string) => `${prefix}-generated-id`)
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('bun', () => ({
  deepEquals: vi.fn((a: any, b: any) => JSON.stringify(a) === JSON.stringify(b))
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

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn(async (_key: string, fn: any) => await fn())
  }))
}));

vi.mock('@metorial/module-organization/src/services/organizationActor', () => ({
  organizationActorService: {
    getSystemActor: vi.fn(),
    createOrganizationActor: vi.fn()
  }
}));

vi.mock('./../src/services/machineAccess', () => ({
  machineAccessService: {}
}));

vi.mock('./../src/services/machineAccessAuth', () => ({
  machineAccessInclude: {}
}));

vi.mock('./../src/services/oauthAuthorization', () => ({
  authorizationInclude: {}
}));

import { oauthAuthorizationInstallationService } from '../src/services/oauthAuthorizationInstallation';

let baseOrg = { oid: 1n, id: 'org_1' } as any;
let baseActor = { oid: 2n, id: 'actor_1' } as any;
let testAuditScope = {
  organizationOid: baseOrg.oid,
  organizationActorOid: baseActor.oid,
  actor: { type: 'org_actor' as const, id: baseActor.id },
  context: { ip: '0.0.0.0' }
} as any;

let baseInstallation = {
  oid: 10n,
  id: 'oauth_install_1',
  organization: baseOrg,
  oauthApplication: {
    type: 'user_facing'
  },
  appActor: null
} as any;

describe('oauthAuthorizationInstallationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.oAuthInstallation.findFirst.mockResolvedValue(baseInstallation);
    mockDb.oAuthInstallation.findMany.mockResolvedValue([]);
    mockDb.oAuthInstallation.findFirstOrThrow.mockResolvedValue(baseInstallation);
    mockDb.oAuthInstallation.update.mockResolvedValue(baseInstallation);
    mockDb.oAuthAuthorization.updateMany.mockResolvedValue({ count: 0 });
  });

  it('allows direct installation get requests for non-internal apps', async () => {
    await oauthAuthorizationInstallationService.getOAuthInstallationById({
      organization: baseOrg,
      oauthInstallationId: 'oauth_install_1'
    });

    expect(mockDb.oAuthInstallation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'oauth_install_1',
          organizationOid: baseOrg.oid,
          oauthApplication: {
            type: {
              not: 'internal'
            }
          }
        })
      })
    );
  });

  it('keeps generic installation lists visible for user and cli auth only', async () => {
    await oauthAuthorizationInstallationService.listOAuthInstallations({
      organization: baseOrg
    });

    expect(mockDb.oAuthInstallation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          oauthApplication: {
            id: undefined,
            type: {
              in: ['user_facing', 'cli_auth']
            }
          }
        })
      })
    );
  });

  it('allows revoking server-side installations through the public service', async () => {
    mockDb.oAuthInstallation.findFirstOrThrow.mockResolvedValue({
      ...baseInstallation,
      oauthApplication: {
        type: 'server_side'
      }
    });

    await oauthAuthorizationInstallationService.revokeOAuthInstallation({
      oauthInstallation: {
        oid: 10n
      } as any,
      auditScope: testAuditScope
    });

    expect(mockDb.oAuthInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'revoked',
          revokedAt: expect.any(Date)
        })
      })
    );
  });

  it('blocks revoking internal installations through the public service', async () => {
    mockDb.oAuthInstallation.findFirstOrThrow.mockResolvedValue({
      ...baseInstallation,
      oauthApplication: {
        type: 'internal'
      }
    });

    await expect(
      oauthAuthorizationInstallationService.revokeOAuthInstallation({
        oauthInstallation: {
          oid: 10n
        } as any,
        auditScope: testAuditScope
      })
    ).rejects.toThrow(ServiceError);

    expect(mockDb.oAuthInstallation.update).not.toHaveBeenCalled();
  });
});
