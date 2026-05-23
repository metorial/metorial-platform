import { ServiceError } from '@mtsrc/error';
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
  generateCustomId: vi.fn((prefix: string, length: number) => `${prefix}-${length}`)
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

vi.mock('@mtsrc/service', () => ({
  Service: {
    create: (_: string, factory: any) => ({
      build: () => factory()
    })
  }
}));

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
});
