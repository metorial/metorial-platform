import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  mockDb,
  machineAccessCreateMock,
  machineAccessUpdateMock,
  getOrganizationByIdForUserMock,
  unifiedApiKeyCreateMock
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
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    oAuthAuthorization: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn()
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
    teamMember: {
      findMany: vi.fn()
    }
  },
  machineAccessCreateMock: vi.fn(),
  machineAccessUpdateMock: vi.fn(),
  getOrganizationByIdForUserMock: vi.fn(),
  unifiedApiKeyCreateMock: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: mockDb,
  withTransaction: (fn: any) => fn(mockDb),
  ID: {
    generateId: vi.fn(async (prefix: string) => `${prefix}-generated-id`)
  }
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

vi.mock('./../src/services/machineAccess', () => ({
  machineAccessService: {
    createMachineAccess: (...args: any[]) => machineAccessCreateMock(...args),
    updateMachineAccess: (...args: any[]) => machineAccessUpdateMock(...args)
  }
}));

vi.mock('@metorial/module-organization', () => ({
  organizationService: {
    getOrganizationByIdForUser: (...args: any[]) => getOrganizationByIdForUserMock(...args)
  }
}));

vi.mock('@lowerdeck/service', () => ({
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
    mockDb.oAuthInstallation.findFirst.mockResolvedValue(null);
    mockDb.oAuthInstallation.upsert.mockImplementation(async ({ create, update }: any) => ({
      oid: 200n,
      ...(create ?? update),
      organization: baseOrg,
      oauthApplication: null,
      serverSideMachineAccess: null
    }));
    mockDb.oAuthInstallation.create.mockImplementation(async ({ data }: any) => ({
      oid: 200n,
      ...data,
      organization: baseOrg,
      oauthApplication: null,
      serverSideMachineAccess: null
    }));
    mockDb.oAuthInstallation.update.mockImplementation(async ({ where, data }: any) => ({
      oid: where.oid,
      ...data,
      organization: baseOrg,
      oauthApplication: null,
      serverSideMachineAccess: null
    }));
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
      status: 'active',
      type: 'user_facing',
      redirectUris: ['https://example.com/callback'],
      scopes: ['organization:read', 'organization:write'],
      accessLevel: 'global',
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

    expect(mockDb.oAuthAuthorizationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'interactive',
          oauthApplicationOid: 100n,
          clientIp: baseContext.ip,
          scopes: ['organization:read'],
          redirectUri: 'https://example.com/callback'
        })
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
        clientId: 'client-1',
        status: 'active',
        type: 'user_facing',
        redirectUris: ['https://example.com/callback'],
        scopes: ['organization:read', 'organization:write'],
        accessLevel: 'global',
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

  it('exchanges authorization codes into access and refresh tokens', async () => {
    mockDb.oAuthAuthorizationRequest.findFirst.mockResolvedValue({
      oid: 500n,
      type: 'interactive',
      status: 'accepted',
      code: 'code-1',
      redirectUri: 'https://example.com/callback',
      codeChallengeMethod: 'none',
      codeChallenge: null,
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        oid: 100n,
        clientId: 'client-1',
        status: 'active',
        scopes: ['organization:read', 'organization:write']
      },
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
        grantType: 'authorization_code',
        clientId: 'client-1',
        code: 'code-1',
        redirectUri: 'https://example.com/callback'
      }
    });

    expect(unifiedApiKeyCreateMock).toHaveBeenCalled();
    expect(mockDb.oAuthToken.create).toHaveBeenCalled();
    expect(result.oauthToken.accessToken).toContain('metorial_oa_');
    expect(result.oauthToken.refreshToken).toContain('metorial_or_');
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
          completelyExpiresAt: expect.any(Date),
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
        status: 'active'
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
    mockDb.oAuthAuthorizationRequest.findFirst.mockResolvedValue({
      oid: 500n,
      type: 'device_code',
      status: 'pending',
      deviceCode: 'device-1',
      lastPollAt: null,
      deniedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        oid: 100n,
        clientId: 'client-1',
        status: 'active',
        redirectUris: [],
        scopes: ['organization:read']
      },
      oauthAuthorization: null
    });

    let result = await oauthAuthorizationService.checkDeviceCodeAuthorizationRequest({
      clientId: 'client-1',
      deviceCode: 'device-1'
    });

    expect(result.status).toBe('pending');
    expect(mockDb.oAuthAuthorizationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastPollAt: expect.any(Date)
        })
      })
    );
  });

  it('rejects device code checks that poll too frequently', async () => {
    mockDb.oAuthAuthorizationRequest.findFirst.mockResolvedValue({
      oid: 500n,
      type: 'device_code',
      status: 'pending',
      deviceCode: 'device-1',
      lastPollAt: new Date(),
      deniedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      oauthApplication: {
        oid: 100n,
        clientId: 'client-1',
        status: 'active',
        redirectUris: [],
        scopes: ['organization:read']
      },
      oauthAuthorization: null
    });

    await expect(
      oauthAuthorizationService.checkDeviceCodeAuthorizationRequest({
        clientId: 'client-1',
        deviceCode: 'device-1'
      })
    ).rejects.toThrow(ServiceError);
  });
});
