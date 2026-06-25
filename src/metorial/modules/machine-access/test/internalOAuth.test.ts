import { ServiceError } from '@lowerdeck/error';
import { addHours, addMinutes } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  mockDb,
  getOrCreateInstallationMock,
  issueInternalOAuthTokenMock,
  machineAccessCreateMock,
  getSystemActorMock
} = vi.hoisted(() => ({
  mockDb: {
    oAuthApplication: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    oAuthInstallation: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    oAuthAuthorization: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    internalOAuthToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn()
    }
  },
  getOrCreateInstallationMock: vi.fn(),
  issueInternalOAuthTokenMock: vi.fn(),
  machineAccessCreateMock: vi.fn(),
  getSystemActorMock: vi.fn()
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

vi.mock('@metorial/id', () => ({
  generateCustomId: vi.fn((prefix: string, length: number) => `${prefix}-${length}`)
}));

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async (value: string) => `hash:${value}`)
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_: string, factory: any) => ({
      build: () => factory()
    })
  }
}));

vi.mock('./../src/services/oauthAuthorizationInstallation', () => ({
  installationInclude: {},
  oauthAuthorizationInstallationService: {
    getOrCreateInstallation: (...args: any[]) => getOrCreateInstallationMock(...args)
  }
}));

vi.mock('./../src/services/oauthAuthorization', () => ({
  authorizationInclude: {},
  oauthAuthorizationService: {
    issueInternalOAuthToken: (...args: any[]) => issueInternalOAuthTokenMock(...args)
  }
}));

vi.mock('./../src/services/machineAccess', () => ({
  machineAccessService: {
    createMachineAccess: (...args: any[]) => machineAccessCreateMock(...args)
  }
}));

vi.mock('./../src/services/machineAccessAuth', () => ({
  machineAccessInclude: {}
}));

vi.mock('@metorial/module-organization/src/services/organizationActor', () => ({
  organizationActorService: {
    getSystemActor: (...args: any[]) => getSystemActorMock(...args)
  }
}));

import { internalOAuthService } from '../src/services/internalOAuth';

let baseContext = { ip: '203.0.113.10' } as any;
let baseOrg = { oid: 1n, id: 'org_1' } as any;
let baseActor = { oid: 10n, id: 'actor_1', organizationOid: 1n } as any;
let baseUser = { oid: 20n, id: 'usr_1' } as any;
let baseMember = {
  oid: 30n,
  id: 'mem_1',
  organizationOid: 1n,
  actor: baseActor,
  user: baseUser
} as any;
let baseApp = {
  oid: 40n,
  id: 'oauth_app_1',
  type: 'internal',
  status: 'active',
  accessLevel: 'organization',
  systemIdentifier: 'explorer',
  name: 'Explorer',
  description: undefined,
  redirectUris: [],
  scopes: ['organization:read', 'organization.instance:read'],
  image: { type: 'default' },
  allowClientSecretlessTokenExchange: false,
  organizationOid: 1n,
  scopedInstallationOid: 50n,
  scopedInstallation: null,
  organization: baseOrg,
  serverSideMachineAccess: null,
  serverSideMachineAccessOid: null
} as any;
let baseInstallation = {
  oid: 50n,
  id: 'oauth_installation_1',
  status: 'active',
  scopes: ['organization:read', 'organization.instance:read'],
  organization: baseOrg,
  organizationOid: 1n,
  oauthApplication: baseApp,
  appActor: baseActor,
  appActorOid: 10n
} as any;
let baseMachineAccess = {
  oid: 60n,
  id: 'macc_1',
  status: 'active',
  type: 'organization_management',
  actor: baseActor,
  organization: baseOrg
} as any;
let baseAuthorization = {
  oid: 70n,
  id: 'oauth_auth_1',
  status: 'active',
  type: 'user',
  scopes: ['organization:read'],
  oauthApplication: baseApp,
  oauthInstallation: baseInstallation,
  oauthInstallationOid: 50n,
  machineAccess: baseMachineAccess,
  machineAccessOid: 60n
} as any;
let baseToken = {
  oid: 80n,
  id: 'oauth_token_1',
  accessToken: 'access-token',
  refreshToken: null,
  accessTokenExpiresAt: addHours(new Date(), 24),
  oauthAuthorization: baseAuthorization
} as any;

describe('internalOAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.oAuthApplication.findFirst.mockResolvedValue(null);
    mockDb.oAuthApplication.create.mockImplementation(async ({ data }: any) => ({
      ...baseApp,
      ...data,
      oid: 40n
    }));
    mockDb.oAuthApplication.update.mockImplementation(async ({ data }: any) => ({
      ...baseApp,
      ...data
    }));
    mockDb.oAuthApplication.findUniqueOrThrow.mockResolvedValue(baseApp);
    mockDb.oAuthInstallation.findFirst.mockResolvedValue(baseInstallation);
    mockDb.oAuthInstallation.update.mockImplementation(async ({ data }: any) => ({
      ...baseInstallation,
      ...data
    }));
    mockDb.oAuthAuthorization.findFirst.mockResolvedValue(baseAuthorization);
    mockDb.oAuthAuthorization.create.mockResolvedValue(baseAuthorization);
    mockDb.internalOAuthToken.findFirst.mockResolvedValue({
      id: 'oit_1',
      organizationOid: 1n,
      oauthApplication: baseApp,
      oauthInstallation: baseInstallation,
      oauthAuthorization: baseAuthorization,
      oauthToken: baseToken,
      machineAccess: baseMachineAccess
    });
    mockDb.internalOAuthToken.findUnique.mockResolvedValue(null);
    mockDb.internalOAuthToken.upsert.mockImplementation(async ({ create, update }: any) => ({
      ...(create ?? update),
      oauthApplication: baseApp,
      oauthInstallation: baseInstallation,
      oauthAuthorization: baseAuthorization,
      oauthToken: baseToken,
      machineAccess: baseMachineAccess
    }));

    getOrCreateInstallationMock.mockResolvedValue(baseInstallation);
    issueInternalOAuthTokenMock.mockResolvedValue(baseToken);
    machineAccessCreateMock.mockResolvedValue(baseMachineAccess);
    getSystemActorMock.mockResolvedValue(baseActor);
  });

  it('creates an internal app and syncs its scoped installation', async () => {
    await internalOAuthService.ensureInternalOAuthApplication({
      organization: baseOrg,
      systemIdentifier: ' explorer ',
      performedBy: baseActor,
      context: baseContext,
      input: {
        name: 'Explorer',
        scopes: ['organization.instance:read', 'organization:read']
      }
    });

    expect(mockDb.oAuthApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'internal',
          accessLevel: 'organization',
          systemIdentifier: 'explorer',
          scopes: ['organization.instance:read', 'organization:read'],
          redirectUris: [],
          allowClientSecretlessTokenExchange: false
        })
      })
    );
    expect(getOrCreateInstallationMock).toHaveBeenCalledWith({
      oauthApplication: expect.objectContaining({
        type: 'internal',
        systemIdentifier: 'explorer'
      }),
      organization: baseOrg
    });
  });

  it('updates internal app scopes and installation scopes', async () => {
    mockDb.oAuthApplication.findFirst.mockResolvedValue({
      ...baseApp,
      scopes: ['organization:read']
    });
    getOrCreateInstallationMock.mockResolvedValue({
      ...baseInstallation,
      scopes: ['organization:read']
    });

    await internalOAuthService.ensureInternalOAuthApplication({
      organization: baseOrg,
      systemIdentifier: 'explorer',
      performedBy: baseActor,
      context: baseContext,
      input: {
        name: 'Explorer',
        scopes: ['organization:read', 'organization.instance:read']
      }
    });

    expect(mockDb.oAuthApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scopes: ['organization.instance:read', 'organization:read']
        })
      })
    );
    expect(mockDb.oAuthInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          scopes: ['organization.instance:read', 'organization:read']
        }
      })
    );
  });

  it('links internal app installations to an existing organization actor', async () => {
    let appActor = {
      oid: 90n,
      id: 'actor_existing',
      organizationOid: 1n
    } as any;

    await internalOAuthService.ensureInternalOAuthApplication({
      organization: baseOrg,
      systemIdentifier: 'explorer',
      performedBy: baseActor,
      appActor,
      context: baseContext,
      input: {
        name: 'Explorer',
        scopes: ['organization:read', 'organization.instance:read']
      }
    });

    expect(getOrCreateInstallationMock).toHaveBeenCalledWith({
      oauthApplication: expect.any(Object),
      organization: baseOrg,
      appActor
    });
  });

  it('short circuits internal app updates when no changes are needed', async () => {
    mockDb.oAuthApplication.findFirst.mockResolvedValue({
      ...baseApp,
      scopedInstallation: baseInstallation
    });
    getOrCreateInstallationMock.mockResolvedValue(baseInstallation);

    await internalOAuthService.ensureInternalOAuthApplication({
      organization: baseOrg,
      systemIdentifier: 'explorer',
      performedBy: baseActor,
      context: baseContext,
      input: {
        name: 'Explorer',
        scopes: ['organization:read', 'organization.instance:read']
      }
    });

    expect(mockDb.oAuthApplication.update).not.toHaveBeenCalled();
    expect(mockDb.oAuthInstallation.update).not.toHaveBeenCalled();
  });

  it('rejects linking internal app installations to actors from another organization', async () => {
    await expect(
      internalOAuthService.ensureInternalOAuthApplication({
        organization: baseOrg,
        systemIdentifier: 'explorer',
        performedBy: baseActor,
        appActor: {
          oid: 91n,
          id: 'actor_other',
          organizationOid: 2n
        } as any,
        context: baseContext,
        input: {
          name: 'Explorer',
          scopes: ['organization:read']
        }
      })
    ).rejects.toBeInstanceOf(ServiceError);

    expect(mockDb.oAuthApplication.create).not.toHaveBeenCalled();
    expect(mockDb.oAuthApplication.update).not.toHaveBeenCalled();
  });

  it('retrieves internal apps and linked records individually by id', async () => {
    mockDb.oAuthApplication.findFirst.mockResolvedValueOnce(baseApp);

    await internalOAuthService.getInternalOAuthApplicationById({
      organization: baseOrg,
      oauthApplicationId: 'oauth_app_1'
    });
    await internalOAuthService.getInternalOAuthInstallationById({
      organization: baseOrg,
      oauthInstallationId: 'oauth_installation_1'
    });
    await internalOAuthService.getInternalOAuthAuthorizationById({
      organization: baseOrg,
      oauthAuthorizationId: 'oauth_auth_1'
    });
    await internalOAuthService.getInternalOAuthTokenById({
      organization: baseOrg,
      internalOAuthTokenId: 'oit_1'
    });

    expect(mockDb.oAuthApplication.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'oauth_app_1',
          organizationOid: baseOrg.oid,
          type: 'internal'
        }
      })
    );
    expect(mockDb.oAuthInstallation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'oauth_installation_1',
          organizationOid: baseOrg.oid,
          oauthApplication: {
            type: 'internal'
          }
        }
      })
    );
    expect(mockDb.oAuthAuthorization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'oauth_auth_1',
          organizationOid: baseOrg.oid,
          oauthApplication: {
            type: 'internal'
          }
        }
      })
    );
    expect(mockDb.internalOAuthToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'oit_1',
          organizationOid: baseOrg.oid,
          oauthApplication: {
            type: 'internal'
          }
        }
      })
    );
  });

  it('reuses a matching token when it expires in more than one hour', async () => {
    let internalOAuthToken = {
      cacheKeyHash: 'hash',
      expiresAt: addHours(new Date(), 2),
      oauthToken: {
        ...baseToken,
        accessTokenExpiresAt: addHours(new Date(), 2),
        oauthAuthorization: baseAuthorization
      },
      machineAccess: baseMachineAccess
    };
    mockDb.internalOAuthToken.findUnique.mockResolvedValue(internalOAuthToken);

    let result = await internalOAuthService.ensureToken({
      oauthApplication: baseApp,
      organization: baseOrg,
      subject: {
        type: 'member',
        member: baseMember
      },
      scope: {
        type: 'organization'
      },
      scopes: ['organization:read'],
      context: baseContext
    });

    expect(result.oauthToken.accessToken).toBe('access-token');
    expect(mockDb.oAuthAuthorization.create).not.toHaveBeenCalled();
    expect(issueInternalOAuthTokenMock).not.toHaveBeenCalled();
  });

  it('creates and caches a new member-linked token when the cached token expires soon', async () => {
    mockDb.internalOAuthToken.findUnique.mockResolvedValue({
      expiresAt: addMinutes(new Date(), 30),
      oauthToken: {
        ...baseToken,
        accessTokenExpiresAt: addMinutes(new Date(), 30),
        oauthAuthorization: baseAuthorization
      },
      machineAccess: baseMachineAccess
    });

    await internalOAuthService.ensureToken({
      oauthApplication: baseApp,
      organization: baseOrg,
      subject: {
        type: 'member',
        member: baseMember
      },
      scope: {
        type: 'organization'
      },
      scopes: ['organization:read'],
      context: baseContext
    });

    expect(machineAccessCreateMock).not.toHaveBeenCalled();
    expect(mockDb.oAuthAuthorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'user',
          scopes: ['organization:read'],
          machineAccessOid: 60n
        })
      })
    );
    let createCall = mockDb.oAuthAuthorization.create.mock.calls[0][0];
    expect(createCall.data).not.toHaveProperty('organizationMemberOid');
    expect(createCall.data).not.toHaveProperty('userOid');
    expect(issueInternalOAuthTokenMock).toHaveBeenCalledWith({
      oauthAuthorization: baseAuthorization,
      context: baseContext
    });
    expect(mockDb.internalOAuthToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationMemberOid: 30n,
          machineAccessOid: 60n,
          scopes: ['organization:read']
        })
      })
    );
  });

  it('rejects token scopes outside the internal app scope range', async () => {
    await expect(
      internalOAuthService.ensureToken({
        oauthApplication: baseApp,
        organization: baseOrg,
        subject: {
          type: 'member',
          member: baseMember
        },
        scope: {
          type: 'organization'
        },
        scopes: ['organization:write'],
        context: baseContext
      })
    ).rejects.toBeInstanceOf(ServiceError);

    expect(mockDb.oAuthAuthorization.create).not.toHaveBeenCalled();
  });
});
