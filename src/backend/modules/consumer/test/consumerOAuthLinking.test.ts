import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mtsrc/hash', () => ({
  Hash: {
    sha256: vi.fn(async value => `hash:${value}`)
  }
}));

vi.mock('@mtsrc/service', () => ({
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
    consumerAuthClientSurface: {
      upsert: vi.fn()
    },
    consumerAuthClient: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn()
    },
    consumerAuthAttempt: {
      update: vi.fn()
    },
    consumerProfile: {
      findFirst: vi.fn()
    },
    magicMcpEndpoint: {
      findFirst: vi.fn()
    },
    consumerAuthTestAuthorization: {
      create: vi.fn(),
      findFirst: vi.fn(),
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

import { Hash } from '@mtsrc/hash';
import { db } from '@metorial/db';
import { magicMcpEndpointService } from '@metorial/module-magic';
import { consumerIntegrationService } from '../src/services/consumerEntities/consumerIntegration';
import {
  consumerOAuthClientService,
  consumerOAuthDashboardService,
  consumerOAuthRegistrationService,
  consumerOAuthTestAuthorizationService
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
      oid: 10n,
      id: 'client-1'
    } as any);
    vi.mocked(db.consumerAuthClient.findFirstOrThrow).mockResolvedValue({
      oid: 10n,
      id: 'client-1'
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
        consumerSurfaceOid: 50n,
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
    expect(db.consumerAuthClientSurface.upsert).toHaveBeenCalledWith(
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
        consumerAuthClientSurfaces: [
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
    expect(db.consumerAuthClientSurface.upsert).toHaveBeenCalledWith(
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

  it('creates a single-use test authorization URL for a portal OAuth URL', async () => {
    vi.mocked(db.consumerProfile.findFirst).mockResolvedValue({
      oid: 30n,
      id: 'consumer-profile-1',
      surfaceOid: 50n,
      surface: {
        oid: 50n,
        id: 'test-7',
        instanceOid: 1n,
        organizationOid: 2n,
        portal: {
          id: 'test-7',
          slug: 'test-7'
        }
      }
    } as any);
    vi.mocked(db.magicMcpEndpoint.findFirst).mockResolvedValue({
      oid: 60n,
      id: 'endpoint-1',
      consumerProfileOid: 30n,
      skillPluginOid: null,
      servers: [{ magicMcpServerOid: 70n }]
    } as any);
    vi.mocked(db.consumerAuthClient.findFirst).mockResolvedValue({
      oid: 10n,
      clientId: 'coaci_test',
      expiresAt: new Date(Date.now() + 60_000),
      skillPluginOid: null,
      consumerAuthClientSurfaces: [
        {
          consumerSurface: {
            oid: 50n,
            id: 'test-7',
            portal: {
              id: 'test-7',
              slug: 'test-7'
            }
          }
        }
      ]
    } as any);
    vi.mocked(db.consumerAuthTestAuthorization.create).mockResolvedValue({
      id: 'coata_test',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date()
    } as any);

    let result = await consumerOAuthTestAuthorizationService.createTestAuthorization({
      instance: {
        oid: 1n,
        organizationOid: 2n
      } as any,
      input: {
        url: 'https://api.test/connect/portal/test-7/oauth/authorize?response_type=code&client_id=coaci_test&state=state-1&code_challenge=challenge-1&code_challenge_method=S256&redirect_uri=http%3A%2F%2F127.0.0.1%3A59843%2Fcallback',
        consumerProfileId: 'consumer-profile-1',
        magicMcpEndpointId: 'endpoint-1'
      }
    });

    expect(result.url).toContain('test_auth_id=coata_test');
    expect(db.consumerAuthTestAuthorization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'coaci_test',
          consumerAuthClientOid: 10n,
          consumerSurfaceOid: 50n,
          consumerProfileOid: 30n,
          magicMcpEndpointOid: 60n,
          state: 'state-1',
          codeChallengeMethod: 's256',
          codeChallenge: 'challenge-1'
        })
      })
    );
  });

  it('adds portal_id for plugin OAuth test authorization URLs when missing', async () => {
    vi.mocked(db.consumerProfile.findFirst).mockResolvedValue({
      oid: 30n,
      id: 'consumer-profile-1',
      surfaceOid: 50n,
      surface: {
        oid: 50n,
        id: 'test-7',
        instanceOid: 1n,
        organizationOid: 2n,
        portal: {
          id: 'test-7',
          slug: 'test-7'
        }
      }
    } as any);
    vi.mocked(db.magicMcpEndpoint.findFirst).mockResolvedValue({
      oid: 60n,
      id: 'endpoint-1',
      consumerProfileOid: 30n,
      skillPluginOid: null,
      servers: [{ magicMcpServerOid: 70n }]
    } as any);
    vi.mocked(db.consumerAuthClient.findFirst).mockResolvedValue({
      oid: 10n,
      clientId: 'coaci_test',
      expiresAt: new Date(Date.now() + 60_000),
      skillPluginOid: null,
      consumerAuthClientSurfaces: []
    } as any);
    vi.mocked(db.consumerAuthTestAuthorization.create).mockResolvedValue({
      id: 'coata_test',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date()
    } as any);

    let result = await consumerOAuthTestAuthorizationService.createTestAuthorization({
      instance: {
        oid: 1n,
        organizationOid: 2n
      } as any,
      input: {
        url: 'https://api.test/connect/plugin/plugin-1/oauth/authorize?response_type=code&client_id=coaci_test&redirect_uri=http%3A%2F%2F127.0.0.1%2Fcallback',
        consumerProfileId: 'consumer-profile-1',
        magicMcpEndpointId: 'endpoint-1'
      }
    });

    expect(result.url).toContain('portal_id=test-7');
    expect(result.url).toContain('test_auth_id=coata_test');
  });

  it('rejects an already consumed test authorization', async () => {
    vi.mocked(db.consumerAuthTestAuthorization.findFirst).mockResolvedValue({
      id: 'coata_test',
      instanceOid: 1n,
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      clientId: 'coaci_test',
      consumerAuthClientOid: 10n,
      redirectUri: 'http://127.0.0.1/callback',
      state: null,
      codeChallenge: null,
      codeChallengeMethod: 'none',
      consumerProfile: {
        oid: 30n
      },
      magicMcpEndpoint: {
        id: 'endpoint-1'
      },
      consumerAuthClient: {
        oid: 10n
      }
    } as any);

    await expect(
      consumerOAuthTestAuthorizationService.consumeTestAuthorization({
        testAuthorizationId: 'coata_test',
        instance: {
          oid: 1n
        } as any,
        portalOAuthAuthorization: {
          consumerAuthClientOid: 10n
        } as any,
        input: {
          clientId: 'coaci_test',
          redirectUri: 'http://127.0.0.1/callback'
        }
      })
    ).rejects.toThrow('already been used');
  });

  it('consumes a test authorization and returns the OAuth callback redirect', async () => {
    vi.mocked(db.consumerAuthTestAuthorization.findFirst).mockResolvedValue({
      id: 'coata_test',
      instanceOid: 1n,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      clientId: 'coaci_test',
      consumerAuthClientOid: 10n,
      redirectUri: 'http://127.0.0.1/callback',
      state: 'state-1',
      codeChallenge: null,
      codeChallengeMethod: 'none',
      consumerProfile: {
        oid: 30n
      },
      magicMcpEndpoint: {
        id: 'endpoint-1'
      },
      consumerAuthClient: {
        oid: 10n
      }
    } as any);
    vi.mocked(magicMcpEndpointService.getMagicMcpEndpointById).mockResolvedValue({
      oid: 60n,
      id: 'endpoint-1',
      consumerProfileOid: 30n,
      servers: [{ magicMcpServerOid: 70n }]
    } as any);
    vi.mocked(db.consumerAuthAttempt.update)
      .mockResolvedValueOnce({
        id: 'attempt-1',
        oid: 80n,
        status: 'pending',
        magicMcpEndpointOid: 60n,
        consumerAuthClient: {
          oid: 10n,
          magicMcpServerOid: null,
          magicMcpEndpointOid: null,
          skillPlugin: null
        },
        magicMcpEndpoint: {
          oid: 60n,
          consumerProfileOid: 30n
        }
      } as any)
      .mockResolvedValueOnce({
        id: 'attempt-1',
        oid: 80n,
        status: 'authorized',
        redirectUri: 'http://127.0.0.1/callback',
        state: 'state-1',
        authorizationCode: 'code-1',
        consumerAuthClient: {
          oid: 10n,
          magicMcpServerOid: null,
          magicMcpEndpointOid: 60n,
          magicMcpEndpoint: {
            oid: 60n,
            consumerProfileOid: 30n
          }
        },
        magicMcpEndpoint: {
          oid: 60n,
          consumerProfileOid: 30n
        }
      } as any);

    let result = await consumerOAuthTestAuthorizationService.consumeTestAuthorization({
      testAuthorizationId: 'coata_test',
      instance: {
        oid: 1n
      } as any,
      portalOAuthAuthorization: {
        id: 'attempt-1',
        status: 'pending',
        consumerAuthClientOid: 10n,
        consumerAuthClient: {
          skillPlugin: null
        }
      } as any,
      input: {
        clientId: 'coaci_test',
        redirectUri: 'http://127.0.0.1/callback',
        state: 'state-1'
      }
    });

    expect(result.redirectUrl).toBe('http://127.0.0.1/callback?code=code-1&state=state-1');
    expect(db.consumerAuthTestAuthorization.update).toHaveBeenCalledWith({
      where: {
        id: 'coata_test'
      },
      data: {
        consumedAt: expect.any(Date),
        consumerAuthAttemptOid: 80n
      }
    });
  });
});
