import { beforeEach, describe, expect, it, vi } from 'vitest';

let { machineAccessCreateMock, machineAccessUpdateMock, mockDb } = vi.hoisted(() => ({
  machineAccessCreateMock: vi.fn(),
  machineAccessUpdateMock: vi.fn(),
  mockDb: {
    oAuthApplication: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    oAuthInstallation: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    oAuthAuthorization: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  withTransaction: (fn: any) => fn(mockDb),
  addAfterTransactionHook: vi.fn((hook: any) => hook()),
  db: mockDb,
  ID: {
    generateId: vi.fn(async (prefix: string) => `${prefix}-generated-id`)
  }
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn().mockResolvedValue(undefined) }
}));
vi.mock('@metorial/id', () => ({
  generateCustomId: vi.fn((prefix: string, length: number) => `${prefix}-${length}`)
}));
vi.mock('./../src/services/machineAccess', () => ({
  machineAccessService: {
    createMachineAccess: (...args: any[]) => machineAccessCreateMock(...args),
    updateMachineAccess: (...args: any[]) => machineAccessUpdateMock(...args)
  }
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

import { oauthApplicationService } from '../src/services/oauthApplication';

let baseContext = {} as any;
let baseOrg = { oid: 'org-oid' } as any;
let baseActor = { oid: 'actor-oid', organizationOid: 'org-oid' } as any;

describe('oauthApplicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    machineAccessCreateMock.mockResolvedValue({
      oid: 'machine-access-oid',
      id: 'machine-access-id',
      name: 'SERVICE ACCOUNTServer App',
      status: 'active',
      type: 'organization_management'
    });
    machineAccessUpdateMock.mockResolvedValue(undefined);

    mockDb.oAuthApplication.create.mockImplementation(async ({ data }: any) => ({
      oid: 'oauth-app-oid',
      ...data
    }));
    mockDb.oAuthInstallation.create.mockImplementation(async ({ data }: any) => ({
      oid: 'oauth-installation-oid',
      ...data
    }));
    mockDb.oAuthApplication.update.mockImplementation(async ({ data }: any) => ({
      oid: 'oauth-app-oid',
      id: 'oauthApplication-generated-id',
      status: data.status ?? 'active',
      type: 'server_side',
      accessLevel: 'organization',
      name: data.name ?? 'Server App',
      description: data.description ?? null,
      websiteUrl: data.websiteUrl ?? null,
      privacyPolicyUrl: data.privacyPolicyUrl ?? null,
      termsOfServiceUrl: data.termsOfServiceUrl ?? null,
      redirectUris: data.redirectUris ?? [],
      scopes: data.scopes ?? ['organization:read'],
      organization: baseOrg,
      serverSideMachineAccess: {
        oid: 'machine-access-oid',
        name: data.name ? `SERVICE ACCOUNT${data.name}` : 'SERVICE ACCOUNTServer App'
      },
      scopedInstallation: {
        oid: 'oauth-installation-oid',
        scopes: data.scopes ?? ['organization:read']
      }
    }));
    mockDb.oAuthApplication.findUniqueOrThrow.mockResolvedValue({
      oid: 'oauth-app-oid',
      id: 'oauthApplication-generated-id',
      status: 'active',
      type: 'server_side',
      accessLevel: 'organization',
      name: 'Server App',
      redirectUris: [],
      scopes: ['organization:read'],
      organization: baseOrg,
      serverSideMachineAccess: {
        oid: 'machine-access-oid',
        name: 'SERVICE ACCOUNTServer App'
      },
      scopedInstallation: {
        oid: 'oauth-installation-oid',
        scopes: ['organization:read']
      }
    });
    mockDb.oAuthApplication.findFirst.mockResolvedValue({
      oid: 'oauth-app-oid',
      id: 'oauth-app-id',
      type: 'user_facing',
      status: 'active',
      organization: baseOrg
    });
    mockDb.oAuthApplication.findMany.mockResolvedValue([]);
    mockDb.oAuthInstallation.update.mockResolvedValue(undefined);
    mockDb.oAuthInstallation.updateMany.mockResolvedValue({ count: 1 });
    mockDb.oAuthAuthorization.updateMany.mockResolvedValue({ count: 1 });
  });

  it('creates a server-side oauth app with scoped installation and machine access', async () => {
    let result = await oauthApplicationService.createOAuthApplication({
      organization: baseOrg,
      performedBy: baseActor,
      context: baseContext,
      input: {
        type: 'server_side',
        accessLevel: 'organization',
        name: 'Server App',
        redirectUris: ['https://example.com/callback'],
        scopes: ['organization:read']
      }
    });

    expect(machineAccessCreateMock).toHaveBeenCalledWith({
      type: 'organization_management',
      organization: baseOrg,
      performedBy: baseActor,
      context: baseContext,
      input: {
        name: 'SERVICE ACCOUNTServer App',
        hasCustomScopes: true,
        scopes: ['organization:read']
      }
    });
    expect(mockDb.oAuthInstallation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serverSideMachineAccessOid: 'machine-access-oid',
          organizationOid: baseOrg.oid,
          scopes: ['organization:read']
        })
      })
    );
    expect(result.scopedInstallation?.oid).toBe('oauth-installation-oid');
  });

  it('updates server-side scopes and syncs them to installation and machine access', async () => {
    await oauthApplicationService.updateOAuthApplication({
      oauthApplication: {
        oid: 'oauth-app-oid',
        type: 'server_side',
        status: 'active',
        accessLevel: 'organization'
      } as any,
      organization: baseOrg,
      performedBy: baseActor,
      context: baseContext,
      input: {
        name: 'Server App 2',
        redirectUris: ['https://example.com/callback'],
        scopes: ['organization:write']
      }
    });

    expect(machineAccessUpdateMock).toHaveBeenCalledWith({
      machineAccess: expect.objectContaining({
        oid: 'machine-access-oid'
      }),
      input: {
        name: 'SERVICE ACCOUNTServer App 2',
        hasCustomScopes: true,
        scopes: ['organization:write']
      },
      performedBy: baseActor,
      context: baseContext
    });
    expect(mockDb.oAuthInstallation.update).toHaveBeenCalledWith({
      where: { oid: 'oauth-installation-oid' },
      data: {
        scopes: ['organization:write']
      }
    });
  });

  it('archives app by revoking authorizations and installations', async () => {
    let result = await oauthApplicationService.archiveOAuthApplication({
      oauthApplication: {
        oid: 'oauth-app-oid',
        type: 'user_facing',
        status: 'active'
      } as any,
      organization: baseOrg,
      performedBy: baseActor,
      context: baseContext
    });

    expect(mockDb.oAuthAuthorization.updateMany).toHaveBeenCalled();
    expect(mockDb.oAuthInstallation.updateMany).toHaveBeenCalled();
    expect(result.status).toBe('archived');
  });
});
