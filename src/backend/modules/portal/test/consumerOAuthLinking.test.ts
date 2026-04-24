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

vi.mock('@metorial/module-consumer', () => ({
  consumerIntegrationService: {
    linkConsumerAuthAttemptToConsumerIntegrationEndpoint: vi.fn()
  },
  consumerProfileService: {
    getGroupsForProfile: vi.fn()
  },
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
import { consumerIntegrationService } from '@metorial/module-consumer';
import { magicMcpEndpointService } from '@metorial/module-magic';
import { consumerOAuthService } from '../src/services/consumerOAuth';

describe('consumerOAuthService integration endpoint linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.consumerAuthClient.count).mockResolvedValue(0 as any);
    vi.mocked(db.consumerClient.upsert).mockResolvedValue({
      oid: 99n
    } as any);
  });

  it('upserts a consumer client during auth client self-registration', async () => {
    vi.mocked(db.consumerAuthClient.create).mockResolvedValue({
      oid: 10n
    } as any);

    await consumerOAuthService.registerConsumerAuthClient({
      consumerSurface: {
        oid: 50n
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
    expect(db.consumerClient.upsert).toHaveBeenCalledWith({
      where: {
        consumerSurfaceOid_hash: {
          consumerSurfaceOid: 50n,
          hash: `hash:${JSON.stringify(['CLI', ['https://example.com/callback']])}`
        }
      },
      create: {
        id: 'consumerClient-id',
        consumerSurfaceOid: 50n,
        hash: `hash:${JSON.stringify(['CLI', ['https://example.com/callback']])}`,
        name: 'CLI',
        redirectUris: ['https://example.com/callback']
      },
      update: {
        name: 'CLI',
        redirectUris: ['https://example.com/callback']
      }
    });
    expect(db.consumerAuthClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consumerClientOid: 99n,
          redirectUris: ['https://example.com/callback']
        })
      })
    );
  });

  it('links an existing auth client to its consumer client', async () => {
    await consumerOAuthService.linkConsumerAuthClientToConsumerClient({
      consumerAuthClient: {
        oid: 10n,
        consumerSurfaceOid: 50n,
        name: 'CLI',
        redirectUris: ['https://z.example/callback', 'https://a.example/callback']
      } as any
    });

    expect(Hash.sha256).toHaveBeenCalledWith(
      JSON.stringify(['CLI', ['https://a.example/callback', 'https://z.example/callback']])
    );
    expect(db.consumerAuthClient.updateMany).toHaveBeenCalledWith({
      where: {
        oid: 10n
      },
      data: {
        consumerClientOid: 99n
      }
    });
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

    await consumerOAuthService.connectConsumerAuthAuthorizationToMagicMcpEndpoint({
      portalOAuthAuthorization: {
        id: 'attempt-1',
        status: 'pending'
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

    await consumerOAuthService.acceptConsumerAuthAuthorization({
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
