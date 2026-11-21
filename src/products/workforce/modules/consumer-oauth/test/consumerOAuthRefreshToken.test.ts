import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async value => `hash:${value}`)
  }
}));

vi.mock('@lowerdeck/id', () => ({
  generateCustomId: vi.fn((prefix: string) => `${prefix}next`)
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
    urls: { appUrl: 'https://app.test', apiUrl: 'https://api.test' }
  }))
}));

vi.mock('@metorial/db', () => {
  let db = {
    consumerAuthClient: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    consumerAuthAttempt: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  };

  return {
    db,
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('@metorial/module-magic', () => ({
  magicMcpTokenService: {
    rotateMagicMcpTokenSecret: vi.fn()
  }
}));

vi.mock('@metorial/consumer-magic-access', () => ({
  grantConsumerOwnedMagicMcpTokenAccess: vi.fn()
}));

vi.mock('@metorial/consumer-oauth-utils', () => ({
  createCodeChallenge: vi.fn(),
  urlsMatch: vi.fn(() => true)
}));

vi.mock('@metorial/module-consumer-entities', () => ({
  consumerIntegrationService: {}
}));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerProfileService: {}
}));

vi.mock('@metorial/module-portal', () => ({
  portalService: {}
}));

import { db } from '@metorial/db';
import { magicMcpTokenService } from '@metorial/module-magic';
import { consumerOAuthTokenService } from '../src/services/token';

let consumerSurface = { oid: 50n, instanceOid: 1n, organizationOid: 2n } as any;

let activeAttempt = {
  id: 'attempt-1',
  status: 'active',
  refreshToken: 'prtl_oatre_old',
  expiresAt: new Date(Date.now() + 60_000),
  consumerProfile: { id: 'consumer-profile-1' },
  magicMcpToken: { id: 'token-1', status: 'active', expiresAt: null }
};

let refresh = () =>
  consumerOAuthTokenService.exchangeConsumerAuthToken({
    consumerSurface,
    magicMcpTarget: null,
    input: {
      clientId: 'client-1',
      grantType: 'refresh_token',
      refreshToken: 'prtl_oatre_old'
    }
  });

describe('consumer OAuth refresh token rotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.consumerAuthClient.findFirst).mockResolvedValue({
      oid: 10n,
      tokenEndpointAuthMethod: 'none',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    } as any);
    vi.mocked(db.consumerAuthAttempt.findFirst).mockResolvedValue(activeAttempt as any);
    vi.mocked(magicMcpTokenService.rotateMagicMcpTokenSecret).mockResolvedValue({
      secret: 'rotated-secret'
    } as any);
  });

  it('rotates the refresh token only while it is still the stored one', async () => {
    vi.mocked(db.consumerAuthAttempt.updateMany).mockResolvedValue({ count: 1 });

    let result = await refresh();

    expect(db.consumerAuthAttempt.updateMany).toHaveBeenCalledWith({
      where: { id: 'attempt-1', status: 'active', refreshToken: 'prtl_oatre_old' },
      data: { refreshToken: 'prtl_oatre_next', expiresAt: expect.any(Date) }
    });
    expect(result).toEqual({
      accessToken: 'rotated-secret',
      refreshToken: 'prtl_oatre_next'
    });
  });

  it('rejects a refresh token that a concurrent request already rotated', async () => {
    vi.mocked(db.consumerAuthAttempt.updateMany).mockResolvedValue({ count: 0 });

    await expect(refresh()).rejects.toMatchObject({
      data: { message: 'Invalid refresh token', oauth: { error: 'invalid_grant' } }
    });
    expect(magicMcpTokenService.rotateMagicMcpTokenSecret).not.toHaveBeenCalled();
    expect(db.consumerAuthAttempt.update).not.toHaveBeenCalled();
  });
});
