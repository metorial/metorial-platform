import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async value => `hash:${value}`)
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    urls: {
      appUrl: 'https://app.test',
      apiUrl: 'https://api.test'
    }
  }))
}));

vi.mock('@metorial/db', () => {
  let db = {
    consumerClient: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    consumerAuthClientConsumerSurface: {
      upsert: vi.fn()
    },
    consumerAuthClient: {
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn()
    },
    consumerAuthAttempt: {
      update: vi.fn()
    }
  };

  return {
    db,
    ID: {
      generateId: vi.fn(async prefix => `${prefix}-id`)
    },
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('../src/services/consumerEntities/consumerIntegration', () => ({
  consumerIntegrationService: {
    linkConsumerAuthAttemptToConsumerIntegrationEndpoint: vi.fn()
  }
}));

vi.mock('../src/services/consumers/consumerProfile', () => ({
  consumerProfileService: {
    getGroupsForProfile: vi.fn()
  }
}));

vi.mock('../src/lib/magicMcpTokenAccess', () => ({
  grantConsumerOwnedMagicMcpTokenAccess: vi.fn()
}));

vi.mock('@metorial/module-magic', () => ({
  magicMcpEndpointService: {
    getMagicMcpEndpointById: vi.fn()
  },
  magicMcpTokenService: {
    createMagicMcpToken: vi.fn(),
    rotateMagicMcpTokenSecret: vi.fn()
  },
  resolveMagicMcpTargetByIdOrAlias: vi.fn()
}));

vi.mock('@metorial/module-file', () => ({
  skillPluginService: {
    getSkillPluginById: vi.fn(),
    getSkillPluginProviders: vi.fn()
  }
}));

vi.mock('../src/lib/oauth', () => ({
  createCodeChallenge: vi.fn(),
  getPortalAllowedRedirectUrlFilters: vi.fn(() => []),
  urlsMatch: vi.fn(() => true),
  validatePortalRedirectUriAgainstAllowedFilters: vi.fn(),
  validatePortalRedirectUrisAgainstAllowedFilters: vi.fn(),
  validateRedirectUri: vi.fn(),
  validateUrlString: vi.fn()
}));

vi.mock('../src/services/portal', () => ({
  portalService: {
    getPortalHost: vi.fn(() => ({
      host: 'https://portal.test'
    }))
  }
}));

import { Hash } from '@lowerdeck/hash';
import { db } from '@metorial/db';
import { magicMcpEndpointService } from '@metorial/module-magic';
import { consumerIntegrationService } from '../src/services/consumerEntities/consumerIntegration';
import {
  consumerOAuthClientService,
  consumerOAuthDashboardService,
  consumerOAuthRegistrationService
} from '../src/services/consumerOAuth';

describe('consumer OAuth integration endpoint linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.consumerAuthClient.count).mockResolvedValue(0 as any);
    vi.mocked(db.consumerClient.findFirst).mockResolvedValue(null as any);
    vi.mocked(db.consumerClient.create).mockResolvedValue({
      oid: 99n
    } as any);
  });

  it('upserts a consumer client during auth client self-registration', async () => {
    vi.mocked(db.consumerAuthClient.create).mockResolvedValue({
      oid: 10n
    } as any);

    await consumerOAuthRegistrationService.registerConsumerAuthClient({
      consumerSurface: {
        oid: 50n,
        instanceOid: 1n,
        organizationOid: 2n
      } as any,
      magicMcpTarget: {
        type: 'endpoint',
        target: {
          oid: 20n
        }
      } as any,
      input: {
        clientName: 'CLI',
        redirectUris: ['https://example.com/callback'],
        registrationIp: '127.0.0.1'
      }
    });

    expect(Hash.sha256).toHaveBeenCalledWith(
      JSON.stringify(['CLI', ['https://example.com/callback']])
    );
    expect(db.consumerClient.create).toHaveBeenCalledWith({
      data: {
        id: 'consumerClient-id',
        instanceOid: 1n,
        organizationOid: 2n,
        hash: `hash:${JSON.stringify(['CLI', ['https://example.com/callback']])}`,
        name: 'CLI',
        redirectUris: ['https://example.com/callback']
      }
    });
    expect(db.consumerAuthClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          redirectUris: ['https://example.com/callback']
        })
      })
    );
    expect(db.consumerAuthClientConsumerSurface.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          consumerSurfaceOid: 50n,
          consumerClientOid: 99n
        })
      })
    );
  });

  it('links an existing auth client to its consumer client', async () => {
    await consumerOAuthClientService.linkConsumerAuthClientToConsumerClient({
      consumerAuthClient: {
        oid: 10n,
        name: 'CLI',
        redirectUris: ['https://z.example/callback', 'https://a.example/callback'],
        consumerAuthClientConsumerSurfaces: [
          {
            consumerSurface: {
              oid: 50n,
              instanceOid: 1n,
              organizationOid: 2n
            }
          }
        ]
      } as any
    });

    expect(Hash.sha256).toHaveBeenCalledWith(
      JSON.stringify(['CLI', ['https://a.example/callback', 'https://z.example/callback']])
    );
    expect(db.consumerAuthClientConsumerSurface.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          consumerSurfaceOid: 50n,
          consumerClientOid: 99n
        })
      })
    );
  });

  it('links a pending authorization when connecting to an owned endpoint', async () => {
    vi.mocked(magicMcpEndpointService.getMagicMcpEndpointById).mockResolvedValue({
      oid: 60n,
      instanceOid: 1n,
      consumerProfileOid: 30n,
      servers: [{ magicMcpServerOid: 70n }]
    } as any);
    vi.mocked(db.consumerAuthAttempt.update).mockResolvedValue({
      oid: 80n,
      consumerAuthClient: {
        oid: 81n
      }
    } as any);

    await consumerOAuthDashboardService.connectConsumerAuthAuthorizationToMagicMcpEndpoint({
      portalOAuthAuthorization: {
        id: 'attempt-1',
        status: 'pending',
        consumerAuthClient: {
          skillPlugin: null
        }
      } as any,
      instance: {
        oid: 1n
      } as any,
      consumerProfile: {
        oid: 30n,
        instanceOid: 1n,
        consumerOid: 40n
      } as any,
      magicMcpEndpointId: 'endpoint-1'
    });

    expect(
      consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint
    ).toHaveBeenCalledWith({
      consumerAuthAttempt: expect.objectContaining({
        oid: 80n
      }),
      consumerProfile: {
        oid: 30n,
        instanceOid: 1n,
        consumerOid: 40n
      },
      magicMcpEndpoint: {
        oid: 60n,
        instanceOid: 1n,
        consumerProfileOid: 30n,
        servers: [{ magicMcpServerOid: 70n }]
      },
      isManaged: false
    });
  });

  it('links authorized attempts for route-owned endpoints during approval', async () => {
    vi.mocked(db.consumerAuthAttempt.update).mockResolvedValue({
      oid: 90n,
      id: 'attempt-2',
      consumerAuthClient: {
        oid: 91n,
        magicMcpServerOid: null,
        magicMcpEndpointOid: 20n,
        magicMcpEndpoint: {
          oid: 20n,
          instanceOid: 1n,
          consumerProfileOid: 30n
        }
      },
      magicMcpEndpoint: null
    } as any);

    await consumerOAuthDashboardService.acceptConsumerAuthAuthorization({
      portalOAuthAuthorization: {
        id: 'attempt-2',
        status: 'pending',
        consumerAuthClient: {
          magicMcpServerOid: null,
          magicMcpEndpointOid: 20n,
          magicMcpEndpoint: {
            oid: 20n,
            instanceOid: 1n,
            consumerProfileOid: 30n
          }
        },
        magicMcpEndpointOid: null,
        magicMcpEndpoint: null
      } as any,
      consumerProfile: {
        oid: 30n,
        instanceOid: 1n,
        consumerOid: 40n
      } as any
    });

    expect(
      consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint
    ).toHaveBeenCalledWith({
      consumerAuthAttempt: expect.objectContaining({
        oid: 90n
      }),
      consumerProfile: {
        oid: 30n,
        instanceOid: 1n,
        consumerOid: 40n
      },
      magicMcpEndpoint: {
        oid: 20n,
        instanceOid: 1n,
        consumerProfileOid: 30n
      },
      isManaged: false
    });
  });
});
