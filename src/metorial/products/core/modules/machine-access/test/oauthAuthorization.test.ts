import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  mockDb,
  machineAccessCreateMock,
  machineAccessUpdateMock,
  getOrganizationByIdForUserMock,
  unifiedApiKeyCreateMock,
  oauthGlobalRepositoryMock,
  getMemberEffectiveAccessMock,
  getGrantedScopesMock
} = vi.hoisted(() => ({
  mockDb: {
    oAuthApplication: {
      findFirst: vi.fn()
    },
    oAuthAuthorizationRequest: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    oAuthInstallation: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    oAuthApplicationClientSecret: {
      findFirst: vi.fn()
    },
    oAuthAuthorization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn()
    },
    oAuthAuthorizationFlow: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn()
    },
    oAuthToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    organizationMember: {
      findFirst: vi.fn()
    },
    accessPolicyAssignment: {
      findMany: vi.fn()
    },
    serviceAccount: {
      findFirst: vi.fn()
    },
    teamMember: {
      findMany: vi.fn()
    },
    consumerProfile: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    consumerSession: {
      upsert: vi.fn(),
      updateMany: vi.fn()
    },
    cliDevice: {
      upsert: vi.fn()
    }
  },
  machineAccessCreateMock: vi.fn(),
  machineAccessUpdateMock: vi.fn(),
  getOrganizationByIdForUserMock: vi.fn(),
  unifiedApiKeyCreateMock: vi.fn(),
  getMemberEffectiveAccessMock: vi.fn(),
  getGrantedScopesMock: vi.fn(),
  oauthGlobalRepositoryMock: {
    getOAuthAuthorizationRequestByDeviceCode: vi.fn(),
    touchOAuthAuthorizationRequestPoll: vi.fn(),
    getOAuthAuthorizationRequestByCode: vi.fn(),
    getOAuthAuthorizationRequestByUrlToken: vi.fn(),
    createOAuthAuthorizationRequest: vi.fn(),
    claimOAuthAuthorizationRequest: vi.fn(),
    acceptOAuthAuthorizationRequest: vi.fn(),
    rejectOAuthAuthorizationRequest: vi.fn()
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
    fire: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn()
  }
}));

vi.mock('bun', () => ({
  deepEquals: vi.fn((a: any, b: any) => JSON.stringify(a) === JSON.stringify(b))
}));

vi.mock('@metorial/id', () => ({
  generateCustomId: vi.fn((prefix: string, length: number) => `${prefix}-${length}`),
  generateCode: vi.fn((length: number) => 'A'.repeat(length))
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    urls: {
      apiUrl: 'https://api.example.com'
    }
  }))
}));

vi.mock('@metorial/api-keys', () => ({
  UnifiedApiKey: {
    create: (...args: any[]) => unifiedApiKeyCreateMock(...args)
  }
}));

vi.mock('@metorial/multi-region', () => ({
  oauthGlobalRepository: oauthGlobalRepositoryMock
}));

vi.mock('./../src/services/machineAccess', () => ({
  machineAccessService: {
    createMachineAccess: (...args: any[]) => machineAccessCreateMock(...args),
    updateMachineAccess: (...args: any[]) => machineAccessUpdateMock(...args)
  }
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn(async (_key: string, fn: any) => await fn())
  }))
}));

vi.mock('@metorial/module-organization/src/services/organization', () => ({
  organizationService: {
    getOrganizationByIdForUser: (...args: any[]) => getOrganizationByIdForUserMock(...args)
  }
}));

vi.mock('@metorial/module-organization/src/services/effectiveAccess', () => ({
  effectiveAccessService: {
    getMemberEffectiveAccess: (...args: any[]) => getMemberEffectiveAccessMock(...args),
    getGrantedScopes: (...args: any[]) => getGrantedScopesMock(...args)
  }
}));

vi.mock('@metorial/module-organization/src/services/organizationActor', () => ({
  organizationActorService: {
    getSystemActor: vi.fn(async () => ({
      oid: 99n,
      id: 'actor_system',
      organizationOid: 1n,
      isSystem: true
    })),
    createOrganizationActor: vi.fn(async () => ({
      oid: 98n,
      id: 'actor_app',
      organizationOid: 1n,
      type: 'oauth_application',
      name: 'APP My App'
    }))
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_: string, factory: any) => ({
      build: () => factory()
    })
  }
}));

import { cliAuthScopes, cliConsumerAuthScopes } from '../src/lib/oauthAuthorizationScopes';
import { oauthAuthorizationService } from '../src/services/oauthAuthorization';

let baseContext = { ip: '203.0.113.10' } as any;
let baseOrg = { oid: 1n, id: 'org_1', slug: 'org-one', enforceTeamAccess: false } as any;
let baseUser = { oid: 10n, id: 'usr_1' } as any;
let baseMember = {
  oid: 11n,
  actorOid: 12n,
  role: 'admin',
  actor: { oid: 12n, organizationOid: 1n },
  user: baseUser,
  organization: baseOrg
} as any;
let testAuditScope = {
  organizationOid: baseOrg.oid,
  organizationActorOid: baseMember.actor.oid,
  actor: { type: 'org_actor' as const, id: baseMember.actor.id ?? 'actor-id' },
  context: baseContext
} as any;

describe('oauthAuthorizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    unifiedApiKeyCreateMock.mockImplementation(({ type }: { type: string }) => ({
      toString: () => `metorial_${type == 'oauth_access_token' ? 'oa' : 'or'}_mock-token`
    }));

    mockDb.oAuthApplication.findFirst.mockResolvedValue({
      oid: 100n,
      id: 'oauthApplication-generated-id',
      name: 'My App',
      clientId: 'client-1',
      status: 'active',
      type: 'user_facing',
      redirectUris: ['https://example.com/callback'],
      scopes: ['organization:read', 'organization:write'],
      accessLevel: 'global',
      allowClientSecretlessAuth: true,
      allowClientSecretlessTokenExchange: true,
      organization: null,
      scopedInstallation: null,
      serverSideMachineAccess: null,
      clientSecrets: []
    });
    machineAccessCreateMock.mockResolvedValue({
      oid: 400n
    });
    machineAccessUpdateMock.mockResolvedValue({
      oid: 401n
    });
    getOrganizationByIdForUserMock.mockResolvedValue({
      organization: baseOrg,
      member: baseMember
    });

    mockDb.teamMember.findMany.mockResolvedValue([]);
    mockDb.organizationMember.findFirst.mockResolvedValue(baseMember);
    mockDb.accessPolicyAssignment.findMany.mockResolvedValue([]);
    mockDb.serviceAccount.findFirst.mockResolvedValue(null);
    mockDb.oAuthAuthorization.findMany.mockResolvedValue([]);
    mockDb.oAuthAuthorizationFlow.findFirst.mockResolvedValue(null);
    mockDb.oAuthAuthorizationFlow.upsert.mockImplementation(
      async ({ create, update }: any) => {
        let data = create ?? update;
        return {
          oid: 510n,
          ...data,
          oauthApplication: {
            oid: 100n,
            clientId: 'client-1',
            status: 'active',
            scopes: ['organization:read', 'organization:write']
          },
          oauthAuthorization: {
            oid: data.oauthAuthorizationOid ?? 300n,
            status: 'active',
            oauthApplication: {
              oid: 100n,
              clientId: 'client-1',
              status: 'active',
              scopes: ['organization:read', 'organization:write']
            },
            oauthInstallation: {
              oid: 200n,
              status: 'active'
            },
            machineAccess: {
              oid: 400n,
              status: 'active'
            }
          },
          organization: baseOrg,
          user: baseUser
        };
      }
    );
    mockDb.oAuthAuthorizationFlow.update.mockImplementation(async ({ where, data }: any) => ({
      oid: where.oid,
      ...data
    }));
    getMemberEffectiveAccessMock.mockResolvedValue({ entries: [] });
    getGrantedScopesMock.mockReturnValue(['organization:read', 'organization:write']);
    oauthGlobalRepositoryMock.claimOAuthAuthorizationRequest.mockImplementation(
      async ({ id }: any) => ({ id })
    );
    oauthGlobalRepositoryMock.acceptOAuthAuthorizationRequest.mockImplementation(
      async ({ id }: any) => ({ id, status: 'accepted' })
    );
    oauthGlobalRepositoryMock.rejectOAuthAuthorizationRequest.mockImplementation(
      async ({ id }: any) => ({ id, status: 'denied' })
    );
    oauthGlobalRepositoryMock.createOAuthAuthorizationRequest.mockImplementation(
      async (data: any) => ({
        ...data,
        status: 'pending',
        oauthApplication: {
          oid: 100n,
          clientId: data.oauthApplicationId,
          type: 'user_facing',
          status: 'active',
          redirectUris: ['https://example.com/callback'],
          scopes: ['organization:read', 'organization:write'],
          accessLevel: 'global',
          organization: null,
          scopedInstallation: null,
          serverSideMachineAccess: null
        },
        oauthAuthorizationFlow: null
      })
    );
    oauthGlobalRepositoryMock.getOAuthAuthorizationRequestByCode.mockResolvedValue(null);
    oauthGlobalRepositoryMock.getOAuthAuthorizationRequestByDeviceCode.mockResolvedValue(null);
    oauthGlobalRepositoryMock.getOAuthAuthorizationRequestByUrlToken.mockResolvedValue(null);
    oauthGlobalRepositoryMock.touchOAuthAuthorizationRequestPoll.mockImplementation(
      async (_args: any) => null
    );
    mockDb.oAuthInstallation.findFirst.mockResolvedValue(null);
    mockDb.oAuthInstallation.findFirstOrThrow.mockImplementation(async ({ where }: any) => ({
      oid: where.oid ?? 200n,
      id: 'oauthInstallation-generated-id',
      status: 'active',
      scopes: ['organization:read', 'organization:write'],
      organization: baseOrg,
      oauthApplication: {
        oid: 100n,
        id: 'oauthApplication-generated-id',
        name: 'My App',
        clientId: 'client-1',
        status: 'active',
        type: 'user_facing',
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
        organization: null
      },
      appActor: null,
      appActorOid: null,
      serverSideMachineAccess: null
    }));
    mockDb.oAuthInstallation.upsert.mockImplementation(async ({ create, update }: any) => ({
      oid: 200n,
      ...(create ?? update),
      organization: baseOrg,
      oauthApplication: {
        oid: 100n,
        id: 'oauthApplication-generated-id',
        name: 'My App',
        clientId: 'client-1',
        status: 'active',
        type: 'user_facing',
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
        organization: null
      },
      appActor: null,
      appActorOid: null,
      serverSideMachineAccess: null
    }));
    mockDb.oAuthInstallation.create.mockImplementation(async ({ data }: any) => ({
      oid: 200n,
      ...data,
      organization: baseOrg,
      oauthApplication: {
        oid: 100n,
        id: 'oauthApplication-generated-id',
        name: 'My App',
        clientId: 'client-1',
        status: 'active',
        type: 'user_facing',
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
        organization: null
      },
      appActor: null,
      appActorOid: null,
      serverSideMachineAccess: null
    }));
    mockDb.oAuthInstallation.update.mockImplementation(async ({ where, data }: any) => ({
      oid: where.oid,
      ...data,
      organization: baseOrg,
      oauthApplication: {
        oid: 100n,
        id: 'oauthApplication-generated-id',
        name: 'My App',
        clientId: 'client-1',
        status: 'active',
        type: 'user_facing',
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
        organization: null
      },
      appActor: {
        oid: 98n,
        id: 'actor_app',
        organizationOid: 1n,
        type: 'oauth_application',
        name: 'APP My App'
      },
      appActorOid: 98n,
      serverSideMachineAccess: null
    }));
    mockDb.oAuthApplicationClientSecret.findFirst.mockResolvedValue({
      oid: 700n,
      oauthApplicationOid: 101n,
      secret: 'secret-1'
    });
    mockDb.oAuthAuthorization.findFirst.mockResolvedValue(null);
    mockDb.oAuthAuthorization.findUnique.mockResolvedValue(null);
    mockDb.consumerSession.upsert.mockImplementation(async ({ create }: any) => ({
      oid: 800n,
      ...create
    }));
    mockDb.oAuthAuthorization.upsert.mockImplementation(async ({ create, update }: any) => {
      let data = create ?? update;
      return {
        oid: 300n,
        ...data,
        oauthApplication: {
          oid: 100n,
          clientId: 'client-1',
          status: 'active',
          scopes: ['organization:read', 'organization:write']
        },
        oauthInstallation: {
          oid: data.oauthInstallationOid ?? 200n,
          status: 'active'
        },
        machineAccess: {
          oid: data.machineAccessOid ?? 400n,
          status: 'active'
        }
      };
    });
    mockDb.oAuthAuthorization.create.mockImplementation(async ({ data }: any) => ({
      oid: 300n,
      ...data,
      oauthApplication: {
        oid: 100n,
        clientId: 'client-1',
        status: 'active',
        scopes: ['organization:read', 'organization:write']
      },
      oauthInstallation: {
        oid: data.oauthInstallationOid,
        status: 'active'
      },
      machineAccess: {
        oid: data.machineAccessOid,
        status: 'active'
      }
    }));
    mockDb.oAuthAuthorization.update.mockImplementation(async ({ where, data }: any) => ({
      oid: where.oid,
      ...data,
      oauthApplication: {
        oid: 100n,
        clientId: 'client-1',
        status: 'active',
        scopes: ['organization:read', 'organization:write']
      },
      oauthInstallation: {
        oid: data.oauthInstallationOid ?? 200n,
        status: 'active'
      },
      machineAccess: {
        oid: data.machineAccessOid ?? 400n,
        status: 'active'
      }
    }));
    mockDb.oAuthAuthorizationRequest.create.mockImplementation(async ({ data }: any) => ({
      oid: 500n,
      ...data,
      oauthApplication: {
        oid: 100n,
        clientId: 'client-1',
        type: 'user_facing',
        status: 'active',
        redirectUris: ['https://example.com/callback'],
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
        organization: null,
        scopedInstallation: null
      }
    }));
    mockDb.oAuthAuthorizationRequest.update.mockImplementation(
      async ({ where, data }: any) => ({
        oid: where.oid,
        ...data,
        oauthApplication: {
          oid: 100n,
          clientId: 'client-1',
          type: 'user_facing',
          status: 'active',
          redirectUris: ['https://example.com/callback'],
          scopes: ['organization:read', 'organization:write'],
          accessLevel: 'global',
          organization: null,
          scopedInstallation: null
        },
        oauthAuthorization: {
          oid: data.oauthAuthorizationOid ?? 300n,
          status: 'active',
          oauthApplication: {
            oid: 100n,
            clientId: 'client-1',
            status: 'active',
            scopes: ['organization:read', 'organization:write']
          },
          oauthInstallation: {
            oid: 200n,
            status: 'active'
          },
          machineAccess: {
            oid: 400n,
            status: 'active'
          }
        }
      })
    );
    mockDb.oAuthToken.findFirst.mockResolvedValue(null);
    mockDb.oAuthToken.create.mockImplementation(async ({ data }: any) => ({
      oid: 600n,
      ...data,
      oauthAuthorization: {
        oid: data.oauthAuthorizationOid,
        oauthApplication: {
          oid: 100n,
          clientId: 'client-1',
          status: 'active',
          scopes: ['organization:read', 'organization:write']
        },
        oauthInstallation: {
          oid: data.oauthInstallationOid,
          status: 'active'
        },
        machineAccess: {
          oid: 400n,
          status: 'active'
        }
      },
      oauthInstallation: {
        oid: data.oauthInstallationOid,
        status: 'active'
      }
    }));
    mockDb.oAuthToken.update.mockImplementation(async ({ where, data }: any) => ({
      oid: where.oid ?? 601n,
      id: 'oauthToken-generated-id',
      oauthAuthorizationOid: 300n,
      ...data,
      oauthAuthorization: {
        oid: 300n,
        oauthInstallationOid: 200n,
        oauthApplication: {
          oid: 100n,
          clientId: 'client-1',
          status: 'active',
          scopes: ['organization:read', 'organization:write']
        },
        oauthInstallation: {
          oid: 200n,
          status: 'active'
        },
        machineAccess: {
          oid: 400n,
          status: 'active'
        }
      }
    }));
  });

  it('creates interactive authorization requests for user-facing apps', async () => {
    mockDb.oAuthApplication.findFirst.mockResolvedValue({
      oid: 100n,
      clientId: 'client-1',
      id: 'oauthApplication-generated-id',
      status: 'active',
      type: 'user_facing',
      redirectUris: ['https://example.com/callback'],
      scopes: ['organization:read', 'organization:write'],
      accessLevel: 'global',
      allowClientSecretlessAuth: true,
      allowClientSecretlessTokenExchange: true,
      organization: null,
      scopedInstallation: null,
      serverSideMachineAccess: null
    });

    let result = await oauthAuthorizationService.createOAuthAuthorizationRequest({
      context: baseContext,
      input: {
        type: 'interactive',
        clientId: 'client-1',
        redirectUri: 'https://example.com/callback',
        scopes: ['organization:read'],
        state: 'state-1',
        codeChallengeMethod: 's256',
        codeChallenge: 'challenge-1'
      }
    });

    expect(oauthGlobalRepositoryMock.createOAuthAuthorizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'interactive',
        oauthApplicationId: 'oauthApplication-generated-id',
        clientIp: baseContext.ip,
        scopes: ['organization:read'],
        redirectUri: 'https://example.com/callback'
      })
    );
    expect(result.type).toBe('interactive');
  });

  it('accepts global authorization requests and creates a user-owned authorization', async () => {
    let oauthAuthorizationRequest = {
      oid: 500n,
      type: 'interactive',
      status: 'pending',
      clientIp: '198.51.100.7',
      scopes: ['organization:read', 'organization:write'],
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        oid: 100n,
        name: 'My App',
        id: 'oauthApplication-generated-id',
        clientId: 'client-1',
        status: 'active',
        type: 'user_facing',
        redirectUris: ['https://example.com/callback'],
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
        allowClientSecretlessAuth: true,
        allowClientSecretlessTokenExchange: true,
        organization: null,
        scopedInstallation: null
      }
    } as any;

    let result = await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
      oauthAuthorizationRequest,
      user: baseUser,
      organizationId: 'org_1',
      context: baseContext
    });

    expect(machineAccessCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'user',
        linkedTo: expect.objectContaining({
          type: 'user',
          user: baseUser
        }),
        input: expect.objectContaining({
          scopes: ['organization:read', 'organization:write']
        })
      })
    );
    expect(mockDb.oAuthAuthorization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          requestingIp: '198.51.100.7',
          acceptingIp: baseContext.ip
        })
      })
    );
    expect(result.oauthAuthorizationRequest.status).toBe('accepted');
  });

  it('rejects accepting an authorization request when the user cannot grant all requested scopes', async () => {
    let limitedMember = {
      ...baseMember,
      role: 'member'
    } as any;

    getOrganizationByIdForUserMock.mockResolvedValue({
      organization: { ...baseOrg, authVersion: 'v2' },
      member: limitedMember
    });
    getGrantedScopesMock.mockReturnValue(['organization:read']);
    mockDb.accessPolicyAssignment.findMany.mockResolvedValue([
      {
        accessPolicyOid: 1n,
        accessPolicy: {
          oid: 1n,
          id: 'apl_everyone',
          document: {
            access: [
              {
                target: 'org_1',
                scopes: ['organization:read']
              }
            ]
          },
          accessPolicyRoles: []
        }
      }
    ]);

    let oauthAuthorizationRequest = {
      id: 'oar_1',
      oid: 500n,
      type: 'interactive',
      status: 'pending',
      clientIp: '198.51.100.7',
      scopes: ['organization:read', 'organization:write'],
      expiresAt: new Date(Date.now() + 60_000),
      oidcScopes: [],
      oauthApplication: {
        oid: 100n,
        name: 'My App',
        id: 'oauthApplication-generated-id',
        clientId: 'client-1',
        status: 'active',
        type: 'user_facing',
        redirectUris: ['https://example.com/callback'],
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
        allowClientSecretlessAuth: true,
        allowClientSecretlessTokenExchange: true,
        organization: null,
        scopedInstallation: null
      }
    } as any;

    await expect(
      oauthAuthorizationService.acceptOAuthAuthorizationRequest({
        oauthAuthorizationRequest,
        user: baseUser,
        organizationId: 'org_1',
        context: baseContext
      })
    ).rejects.toThrow(
      'You cannot accept this app because it requires permissions that you do not have'
    );

    expect(oauthGlobalRepositoryMock.claimOAuthAuthorizationRequest).not.toHaveBeenCalled();
  });

  it('exchanges authorization codes into access and refresh tokens', async () => {
    oauthGlobalRepositoryMock.getOAuthAuthorizationRequestByCode.mockResolvedValue({
      id: 'oarf_1',
      oauthApplicationId: 'oauthApplication-generated-id',
      type: 'interactive',
      status: 'accepted',
      code: 'code-1',
      redirectUri: 'https://example.com/callback',
      codeChallengeMethod: 'none',
      codeChallenge: null,
      expiresAt: new Date(Date.now() + 60_000)
    });
    mockDb.oAuthAuthorizationFlow.findFirst.mockResolvedValue({
      oid: 500n,
      id: 'oarf_1',
      type: 'interactive',
      status: 'accepted',
      redirectUri: 'https://example.com/callback',
      codeChallengeMethod: 'none',
      codeChallenge: null,
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        oid: 100n,
        id: 'oauthApplication-generated-id',
        clientId: 'client-1',
        status: 'active',
        scopes: ['organization:read', 'organization:write'],
        type: 'user_facing',
        redirectUris: ['https://example.com/callback'],
        accessLevel: 'global',
        allowClientSecretlessAuth: true,
        allowClientSecretlessTokenExchange: true,
        organization: null,
        scopedInstallation: null,
        serverSideMachineAccess: null
      },
      oauthAuthorization: {
        oid: 300n,
        oauthInstallationOid: 200n,
        status: 'active',
        oauthApplication: {
          oid: 100n,
          clientId: 'client-1',
          status: 'active',
          scopes: ['organization:read', 'organization:write'],
          organization: null
        },
        oauthInstallation: {
          oid: 200n,
          status: 'active',
          organization: baseOrg,
          oauthApplication: {
            oid: 100n,
            clientId: 'client-1',
            status: 'active',
            scopes: ['organization:read', 'organization:write'],
            organization: null
          },
          appActor: null,
          serverSideMachineAccess: null
        },
        machineAccess: {
          oid: 400n,
          status: 'active'
        },
        organizationMember: baseMember,
        user: baseUser
      },
      organization: baseOrg,
      user: baseUser
    });

    let result = await oauthAuthorizationService.exchangeOAuthToken({
      context: baseContext,
      input: {
        grantType: 'authorization_code',
        clientId: 'client-1',
        code: 'code-1',
        redirectUri: 'https://example.com/callback'
      }
    });

    expect(unifiedApiKeyCreateMock).toHaveBeenCalled();
    expect(mockDb.oAuthToken.create).toHaveBeenCalled();
    expect(result.oauthToken.accessToken).toContain('metorial_oa_');
    expect(result.oauthToken.refreshToken).toBeNull();
  });

  it('rotates refresh tokens by updating the existing token row', async () => {
    mockDb.oAuthToken.findFirst.mockResolvedValue({
      oid: 601n,
      refreshToken: 'metorial_or_old',
      oauthAuthorization: {
        oid: 300n,
        oauthInstallationOid: 200n,
        status: 'active',
        oauthApplication: {
          oid: 100n,
          clientId: 'client-1',
          status: 'active',
          scopes: ['organization:read', 'organization:write']
        },
        oauthInstallation: {
          oid: 200n,
          status: 'active'
        },
        machineAccess: {
          oid: 400n,
          status: 'active'
        }
      }
    });

    let result = await oauthAuthorizationService.exchangeOAuthToken({
      context: baseContext,
      input: {
        grantType: 'refresh_token',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        refreshToken: 'metorial_or_old'
      }
    });

    expect(mockDb.oAuthToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 601n },
        data: expect.objectContaining({
          accessToken: expect.stringContaining('metorial_oa_'),
          refreshToken: expect.stringContaining('metorial_or_'),
          accessTokenExpiresAt: expect.any(Date),
          completelyExpiresAt: null,
          oauthInstallationOid: 200n
        })
      })
    );
    expect(mockDb.oAuthToken.create).not.toHaveBeenCalled();
    expect(result.oauthToken.accessToken).toContain('metorial_oa_');
  });

  it('requires a client secret to refresh tokens of confidential clients', async () => {
    let refreshableToken = (oauthApplication: Record<string, unknown>) => ({
      oid: 601n,
      refreshToken: 'metorial_or_old',
      oauthAuthorization: {
        oid: 300n,
        status: 'active',
        oauthApplication: { oid: 100n, clientId: 'client-1', status: 'active', ...oauthApplication }
      }
    });
    let refresh = () =>
      oauthAuthorizationService.exchangeOAuthToken({
        context: baseContext,
        input: {
          grantType: 'refresh_token',
          clientId: 'client-1',
          refreshToken: 'metorial_or_old'
        }
      });

    mockDb.oAuthToken.findFirst.mockResolvedValue(
      refreshableToken({ type: 'user_facing', allowClientSecretlessTokenExchange: false })
    );
    await expect(refresh()).rejects.toMatchObject({
      data: expect.objectContaining({ status: 401 })
    });
    expect(mockDb.oAuthToken.update).not.toHaveBeenCalled();
  });

  it('exchanges server-side client credentials without issuing a refresh token', async () => {
    mockDb.oAuthApplication.findFirst.mockResolvedValue({
      oid: 101n,
      clientId: 'client-server',
      clientSecret: 'secret-1',
      status: 'active',
      type: 'server_side',
      name: 'Server App',
      redirectUris: [],
      scopes: ['organization:read', 'organization:write'],
      accessLevel: 'organization',
      organization: baseOrg,
      scopedInstallation: null,
      serverSideMachineAccess: {
        oid: 900n,
        status: 'active',
        actorOid: 98n
      },
      serverSideMachineAccessOid: 900n
    });

    let result = await oauthAuthorizationService.exchangeOAuthToken({
      context: baseContext,
      input: {
        grantType: 'client_credentials',
        clientId: 'client-server',
        clientSecret: 'secret-1',
        scopes: ['organization:write']
      }
    });

    expect(mockDb.oAuthAuthorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'server_side',
          scopes: ['organization:write'],
          machineAccessOid: 900n
        })
      })
    );
    expect(result.oauthToken.refreshToken).toBeNull();
  });

  it('checks device code state and updates last poll timestamp', async () => {
    oauthGlobalRepositoryMock.getOAuthAuthorizationRequestByDeviceCode.mockResolvedValue({
      id: 'oar_1',
      oauthApplicationId: 'oauthApplication-generated-id',
      type: 'device_code',
      status: 'pending',
      deviceCode: 'device-1',
      lastPollAt: null,
      deniedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        clientId: 'client-1'
      }
    });
    oauthGlobalRepositoryMock.touchOAuthAuthorizationRequestPoll.mockResolvedValue({
      id: 'oar_1',
      oauthApplicationId: 'oauthApplication-generated-id',
      type: 'device_code',
      status: 'pending',
      deviceCode: 'device-1',
      lastPollAt: new Date(),
      deniedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        clientId: 'client-1'
      }
    });

    let result = await oauthAuthorizationService.checkDeviceCodeAuthorizationRequest({
      clientId: 'client-1',
      deviceCode: 'device-1'
    });

    expect(result.status).toBe('pending');
    expect(oauthGlobalRepositoryMock.touchOAuthAuthorizationRequestPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'oar_1',
        at: expect.any(Date)
      })
    );
  });

  it('rejects device code checks that poll too frequently', async () => {
    oauthGlobalRepositoryMock.getOAuthAuthorizationRequestByDeviceCode.mockResolvedValue({
      id: 'oar_1',
      oauthApplicationId: 'oauthApplication-generated-id',
      type: 'device_code',
      status: 'pending',
      deviceCode: 'device-1',
      lastPollAt: new Date(),
      deniedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        clientId: 'client-1'
      }
    });

    await expect(
      oauthAuthorizationService.checkDeviceCodeAuthorizationRequest({
        clientId: 'client-1',
        deviceCode: 'device-1'
      })
    ).rejects.toThrow(ServiceError);
  });

  it('allows direct authorization get requests for non-internal apps', async () => {
    mockDb.oAuthAuthorization.findFirst.mockResolvedValue({
      oid: 300n,
      id: 'oauth_auth_1',
      oauthApplication: {
        type: 'server_side'
      }
    });

    await oauthAuthorizationService.getOAuthAuthorizationById({
      organization: baseOrg,
      oauthAuthorizationId: 'oauth_auth_1'
    });

    expect(mockDb.oAuthAuthorization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'oauth_auth_1',
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

  it('keeps generic authorization lists visible for user and cli auth only', async () => {
    let paginator = await oauthAuthorizationService.listOAuthAuthorizations({
      organization: baseOrg
    });
    await paginator.run({});

    expect(mockDb.oAuthAuthorization.findMany).toHaveBeenCalledWith(
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

  it('allows revoking server-side service account authorizations through the public service', async () => {
    mockDb.oAuthAuthorization.findFirstOrThrow.mockResolvedValue({
      oid: 300n,
      status: 'active',
      oauthApplication: {
        type: 'server_side'
      },
      oauthInstallation: {
        organization: baseOrg,
        appActor: null
      }
    });

    await oauthAuthorizationService.revokeOAuthAuthorization({
      oauthAuthorization: {
        oid: 300n
      } as any,
      auditScope: testAuditScope
    });

    expect(mockDb.oAuthAuthorization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'revoked',
          revokedAt: expect.any(Date)
        })
      })
    );
  });

  it('blocks revoking internal authorizations through the public service', async () => {
    mockDb.oAuthAuthorization.findFirstOrThrow.mockResolvedValue({
      oid: 300n,
      status: 'active',
      oauthApplication: {
        type: 'internal'
      },
      oauthInstallation: {
        organization: baseOrg,
        appActor: null
      }
    });

    await expect(
      oauthAuthorizationService.revokeOAuthAuthorization({
        oauthAuthorization: {
          oid: 300n
        } as any,
        auditScope: testAuditScope
      })
    ).rejects.toThrow(ServiceError);

    expect(mockDb.oAuthAuthorization.update).not.toHaveBeenCalled();
  });

  describe('consumer subjects', () => {
    let memberApplication = (overrides: Record<string, any> = {}) => ({
      oid: 100n,
      id: 'oauthApplication-generated-id',
      name: 'My App',
      clientId: 'client-1',
      status: 'active',
      type: 'user_facing',
      subjectType: 'organization_member',
      redirectUris: ['https://example.com/callback'],
      scopes: ['organization:read', 'organization:write'],
      accessLevel: 'global',
      allowClientSecretlessTokenExchange: true,
      organizationOid: null,
      organization: null,
      scopedInstallation: null,
      serverSideMachineAccess: null,
      clientSecrets: [],
      ...overrides
    });

    let consumerApplication = (overrides: Record<string, any> = {}) =>
      memberApplication({
        subjectType: 'consumer',
        scopes: ['consumer#instance:read', 'consumer#instance.file:read'],
        ...overrides
      });

    let cliApplication = () =>
      memberApplication({
        type: 'cli_auth',
        subjectType: 'consumer_or_organization_member',
        scopes: []
      });

    let consumerProfile = (overrides: Record<string, any> = {}) => ({
      oid: 900n,
      id: 'cpr_1',
      status: 'active',
      name: 'Portal User',
      email: 'portal@example.com',
      organizationOid: baseOrg.oid,
      instanceOid: 20n,
      organizationActorOid: 21n,
      organization: baseOrg,
      instance: { oid: 20n, id: 'ins_1' },
      consumer: { oid: 901n, userOid: baseUser.oid, isServiceAccount: false },
      surface: {
        oid: 902n,
        type: 'portal',
        status: 'active',
        portal: { oid: 903n, id: 'prt_1', name: 'Portal', status: 'active' }
      },
      ...overrides
    });

    let consumerRequest = (oauthApplication: any) =>
      ({
        id: 'oar_consumer',
        type: 'interactive',
        status: 'pending',
        subjectType: 'consumer',
        clientIp: '198.51.100.7',
        scopes: ['consumer#instance:read'],
        oidcScopes: [],
        expiresAt: new Date(Date.now() + 60_000),
        oauthApplication
      }) as any;

    let createInteractiveRequest = (subjectType?: 'organization_member' | 'consumer') =>
      oauthAuthorizationService.createOAuthAuthorizationRequest({
        context: baseContext,
        input: {
          type: 'interactive',
          clientId: 'client-1',
          redirectUri: 'https://example.com/callback',
          scopes: [],
          subjectType
        }
      });

    it('uses the fixed subject of an application when none is requested', async () => {
      mockDb.oAuthApplication.findFirst.mockResolvedValue(consumerApplication());

      await createInteractiveRequest();

      expect(oauthGlobalRepositoryMock.createOAuthAuthorizationRequest).toHaveBeenCalledWith(
        expect.objectContaining({ subjectType: 'consumer' })
      );
    });

    it('rejects a requested subject that differs from the fixed application subject', async () => {
      mockDb.oAuthApplication.findFirst.mockResolvedValue(memberApplication());

      await expect(createInteractiveRequest('consumer')).rejects.toThrow(ServiceError);
      expect(oauthGlobalRepositoryMock.createOAuthAuthorizationRequest).not.toHaveBeenCalled();
    });

    it('defaults cli requests to the organization member subject', async () => {
      mockDb.oAuthApplication.findFirst.mockResolvedValue(cliApplication());

      await oauthAuthorizationService.createCliAuthAuthorizationRequest({
        context: baseContext
      });

      expect(oauthGlobalRepositoryMock.createOAuthAuthorizationRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectType: 'organization_member',
          scopes: cliAuthScopes
        })
      );
    });

    it('lets cli requests choose the consumer subject with consumer scopes', async () => {
      mockDb.oAuthApplication.findFirst.mockResolvedValue(cliApplication());

      await oauthAuthorizationService.createCliAuthAuthorizationRequest({
        context: baseContext,
        subjectType: 'consumer'
      });

      expect(oauthGlobalRepositoryMock.createOAuthAuthorizationRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectType: 'consumer',
          scopes: cliConsumerAuthScopes
        })
      );
    });

    it('rejects consumer scopes on organization member applications', async () => {
      mockDb.oAuthApplication.findFirst.mockResolvedValue(memberApplication());

      await expect(
        oauthAuthorizationService.createOAuthAuthorizationRequest({
          context: baseContext,
          input: {
            type: 'interactive',
            clientId: 'client-1',
            redirectUri: 'https://example.com/callback',
            scopes: ['consumer#instance:read']
          }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('accepts consumer requests with an instance-bound consumer authorization', async () => {
      mockDb.consumerProfile.findFirst.mockResolvedValue(consumerProfile());

      let result = await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
        oauthAuthorizationRequest: consumerRequest(consumerApplication()),
        user: baseUser,
        organizationId: baseOrg.id,
        consumerProfileId: 'cpr_1',
        context: baseContext
      });

      expect(getOrganizationByIdForUserMock).not.toHaveBeenCalled();
      expect(machineAccessCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'instance_consumer',
          kind: 'user',
          user: baseUser,
          consumerProfile: expect.objectContaining({ oid: 900n }),
          input: expect.objectContaining({ scopes: ['consumer#instance:read'] })
        })
      );
      expect(mockDb.oAuthAuthorization.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            consumerProfileOid_oauthApplicationOid: {
              consumerProfileOid: 900n,
              oauthApplicationOid: 100n
            }
          },
          create: expect.objectContaining({
            subjectType: 'consumer',
            consumerProfileOid: 900n,
            instanceOid: 20n
          })
        })
      );
      expect(mockDb.consumerSession.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { oauthAuthorizationOid: 300n },
          update: expect.objectContaining({ loggedOutAt: null })
        })
      );
      expect(mockDb.oAuthAuthorizationFlow.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            subjectType: 'consumer',
            consumerProfileOid: 900n,
            instanceOid: 20n
          })
        })
      );
      expect(result.oauthAuthorizationRequest.status).toBe('accepted');
    });

    it('rejects consumer profiles that are not on a portal surface', async () => {
      mockDb.consumerProfile.findFirst.mockResolvedValue(
        consumerProfile({
          surface: { oid: 902n, type: 'cli', status: 'active', portal: null }
        })
      );

      await expect(
        oauthAuthorizationService.acceptOAuthAuthorizationRequest({
          oauthAuthorizationRequest: consumerRequest(consumerApplication()),
          user: baseUser,
          organizationId: baseOrg.id,
          consumerProfileId: 'cpr_1',
          context: baseContext
        })
      ).rejects.toThrow(ServiceError);
      expect(oauthGlobalRepositoryMock.claimOAuthAuthorizationRequest).not.toHaveBeenCalled();
    });

    it('rejects consumer profiles that belong to another user', async () => {
      mockDb.consumerProfile.findFirst.mockResolvedValue(
        consumerProfile({
          consumer: { oid: 901n, userOid: 999n, isServiceAccount: false }
        })
      );

      await expect(
        oauthAuthorizationService.acceptOAuthAuthorizationRequest({
          oauthAuthorizationRequest: consumerRequest(consumerApplication()),
          user: baseUser,
          organizationId: baseOrg.id,
          consumerProfileId: 'cpr_1',
          context: baseContext
        })
      ).rejects.toThrow(ServiceError);
      expect(oauthGlobalRepositoryMock.claimOAuthAuthorizationRequest).not.toHaveBeenCalled();
    });

    it('rejects consumer profiles from another organization for organization-scoped apps', async () => {
      mockDb.consumerProfile.findFirst.mockResolvedValue(
        consumerProfile({ organizationOid: 2n })
      );

      await expect(
        oauthAuthorizationService.acceptOAuthAuthorizationRequest({
          oauthAuthorizationRequest: consumerRequest(
            consumerApplication({
              accessLevel: 'organization',
              organizationOid: baseOrg.oid,
              organization: baseOrg
            })
          ),
          user: baseUser,
          organizationId: baseOrg.id,
          consumerProfileId: 'cpr_1',
          context: baseContext
        })
      ).rejects.toThrow(ServiceError);
      expect(oauthGlobalRepositoryMock.claimOAuthAuthorizationRequest).not.toHaveBeenCalled();
    });

    it('keeps member and consumer authorizations of the same user and app apart', async () => {
      let cliApp = cliApplication();
      mockDb.consumerProfile.findFirst.mockResolvedValue(consumerProfile());

      await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
        oauthAuthorizationRequest: {
          ...consumerRequest(cliApp),
          id: 'oar_member',
          subjectType: 'organization_member',
          scopes: ['organization:read']
        },
        user: baseUser,
        organizationId: baseOrg.id,
        context: baseContext
      });

      await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
        oauthAuthorizationRequest: consumerRequest(cliApp),
        user: baseUser,
        organizationId: baseOrg.id,
        consumerProfileId: 'cpr_1',
        context: baseContext
      });

      expect(mockDb.cliDevice.upsert).toHaveBeenCalledTimes(1);

      let upsertKeys = mockDb.oAuthAuthorization.upsert.mock.calls.map(
        ([args]: any[]) => args.where
      );
      expect(upsertKeys).toEqual([
        {
          organizationMemberOid_oauthApplicationOid: {
            organizationMemberOid: baseMember.oid,
            oauthApplicationOid: 100n
          }
        },
        {
          consumerProfileOid_oauthApplicationOid: {
            consumerProfileOid: 900n,
            oauthApplicationOid: 100n
          }
        }
      ]);
    });

    it('logs out the linked consumer session when an authorization is revoked', async () => {
      mockDb.oAuthAuthorization.findFirstOrThrow.mockResolvedValue({
        oid: 300n,
        status: 'active',
        subjectType: 'consumer',
        consumerProfile: consumerProfile(),
        oauthApplication: { type: 'user_facing' },
        oauthInstallation: { organization: baseOrg, appActor: null }
      });

      await oauthAuthorizationService.revokeOAuthAuthorization({
        oauthAuthorization: { oid: 300n } as any,
        auditScope: testAuditScope
      });

      expect(mockDb.consumerSession.updateMany).toHaveBeenCalledWith({
        where: { oauthAuthorization: { oid: 300n }, loggedOutAt: null },
        data: { loggedOutAt: expect.any(Date) }
      });
    });
  });
});
