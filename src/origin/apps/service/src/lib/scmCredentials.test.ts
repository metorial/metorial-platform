import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  delegate: { enabled: true },
  db: {
    scmInstallation: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    }
  },
  nebula: {
    create: vi.fn(),
    update: vi.fn(),
    use: vi.fn(),
    disable: vi.fn()
  }
}));

vi.mock('../db', () => ({ db: mocks.db }));
vi.mock('../env', () => ({
  get delegateSecretsToNebula() {
    return mocks.delegate.enabled;
  }
}));
vi.mock('../id', () => ({
  getId: () => ({ oid: 1n, id: 'osi_new' })
}));
vi.mock('../nebula', () => ({
  getNebulaClient: () => ({ secret: mocks.nebula }),
  getNebulaTenantForOriginTenant: async () => ({
    id: 'otn_tenant',
    nebulaTenantId: 'nt_tenant'
  })
}));

import {
  readBackendSecret,
  readInstallationTokens,
  readWebhookSigningSecret,
  stageWebhookSigningSecret,
  upsertInstallationWithTokens,
  writeBackendSecrets,
  writeRefreshedInstallationTokens
} from './scmCredentials';

let installation = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'osi_1',
    oid: 7n,
    tenantOid: 3n,
    accessToken: 'local-access',
    refreshToken: 'local-refresh',
    tokensNebulaSecretId: null,
    ...overrides
  }) as any;

let backend = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'osb_1',
    tenantOid: 3n,
    clientSecret: null,
    clientSecretNebulaSecretId: null,
    appPrivateKey: null,
    appPrivateKeyNebulaSecretId: null,
    appWebhookSecret: null,
    appWebhookSecretNebulaSecretId: null,
    ...overrides
  }) as any;

let refreshed = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  expiresAt: new Date('2030-01-01T00:00:00Z')
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.delegate.enabled = true;
  mocks.nebula.create.mockResolvedValue({ id: 'nebula_new' });
  mocks.nebula.update.mockResolvedValue({});
  mocks.nebula.disable.mockResolvedValue({});
});

describe('installation tokens', () => {
  it('reads local tokens without calling Nebula', async () => {
    let tokens = await readInstallationTokens(installation(), 'note');

    expect(tokens).toEqual({ accessToken: 'local-access', refreshToken: 'local-refresh' });
    expect(mocks.nebula.use).not.toHaveBeenCalled();
  });

  it('reads delegated tokens from Nebula with a proof bound to the installation', async () => {
    mocks.nebula.use.mockResolvedValue({
      plaintext: JSON.stringify({
        accessToken: 'remote-access',
        refreshToken: 'remote-refresh'
      })
    });

    let tokens = await readInstallationTokens(
      installation({
        accessToken: null,
        refreshToken: null,
        tokensNebulaSecretId: 'nebula_1'
      }),
      'origin:test'
    );

    expect(tokens).toEqual({ accessToken: 'remote-access', refreshToken: 'remote-refresh' });
    expect(mocks.nebula.use).toHaveBeenCalledWith({
      tenantId: 'nt_tenant',
      secretId: 'nebula_1',
      proof: {
        originResourceId: 'osi_1',
        tenantId: 'otn_tenant',
        purpose: 'scm_installation_tokens'
      },
      note: 'origin:test'
    });
  });

  it('updates the Nebula secret and only the expiry for a delegated installation', async () => {
    await writeRefreshedInstallationTokens(
      installation({
        accessToken: null,
        refreshToken: null,
        tokensNebulaSecretId: 'nebula_1'
      }),
      refreshed
    );

    expect(mocks.nebula.update).toHaveBeenCalledWith(
      expect.objectContaining({
        secretId: 'nebula_1',
        secret: JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' })
      })
    );
    expect(mocks.db.scmInstallation.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: { accessTokenExpiresAt: refreshed.expiresAt }
    });
  });

  it('moves a legacy installation to Nebula on its next refresh', async () => {
    await writeRefreshedInstallationTokens(installation(), refreshed);

    expect(mocks.nebula.create).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'scm_installation_tokens' })
    );
    expect(mocks.db.scmInstallation.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: {
        tokensNebulaSecretId: 'nebula_new',
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: refreshed.expiresAt
      }
    });
  });

  it('keeps writing locally for a legacy installation while delegation is off', async () => {
    mocks.delegate.enabled = false;

    await writeRefreshedInstallationTokens(installation(), refreshed);

    expect(mocks.nebula.create).not.toHaveBeenCalled();
    expect(mocks.db.scmInstallation.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        accessTokenExpiresAt: refreshed.expiresAt
      }
    });
  });

  it('fails without touching the row when Nebula rejects the write', async () => {
    mocks.nebula.create.mockRejectedValue(new Error('nebula down'));

    await expect(writeRefreshedInstallationTokens(installation(), refreshed)).rejects.toThrow(
      'nebula down'
    );
    expect(mocks.db.scmInstallation.update).not.toHaveBeenCalled();
  });

  it('disables a freshly created secret when the row update fails', async () => {
    mocks.db.scmInstallation.update.mockRejectedValue(new Error('db down'));

    await expect(writeRefreshedInstallationTokens(installation(), refreshed)).rejects.toThrow(
      'db down'
    );
    expect(mocks.nebula.disable).toHaveBeenCalledWith({
      tenantId: 'nt_tenant',
      secretId: 'nebula_new'
    });
  });

  it('stores tokens of a new connection in Nebula and not on the row', async () => {
    mocks.db.scmInstallation.findUnique.mockResolvedValue(null);
    mocks.db.scmInstallation.upsert.mockImplementation(async (d: any) => d.create);

    let created = await upsertInstallationWithTokens(
      {
        provider: 'gitlab',
        tenantOid: 3n,
        backendOid: 4n,
        ownerActorOid: 5n,
        externalAccountId: '99',
        externalAccountLogin: 'login'
      },
      refreshed
    );

    expect(created).toMatchObject({
      id: 'osi_new',
      tokensNebulaSecretId: 'nebula_new',
      accessToken: null,
      refreshToken: null
    });
    expect(mocks.nebula.create).toHaveBeenCalledWith(
      expect.objectContaining({
        proof: expect.objectContaining({ originResourceId: 'osi_new' })
      })
    );
  });

  it('updates the existing Nebula secret when a delegated account reconnects', async () => {
    mocks.db.scmInstallation.findUnique.mockResolvedValue(
      installation({ tokensNebulaSecretId: 'nebula_1' })
    );
    mocks.db.scmInstallation.upsert.mockImplementation(async (d: any) => d.update);

    await upsertInstallationWithTokens(
      {
        provider: 'gitlab',
        tenantOid: 3n,
        backendOid: 4n,
        ownerActorOid: 5n,
        externalAccountId: '99',
        externalAccountLogin: 'login'
      },
      refreshed
    );

    expect(mocks.nebula.create).not.toHaveBeenCalled();
    expect(mocks.nebula.update).toHaveBeenCalledWith(
      expect.objectContaining({
        secretId: 'nebula_1',
        proof: expect.objectContaining({ originResourceId: 'osi_1' })
      })
    );
  });
});

describe('backend secrets', () => {
  it('stores new secrets in Nebula and nulls the local columns', async () => {
    let result = await writeBackendSecrets({
      backend: backend(),
      secrets: { clientSecret: 'secret' }
    });

    expect(result.patch).toEqual({
      clientSecret: null,
      clientSecretNebulaSecretId: 'nebula_new'
    });
    expect(result.createdNebulaSecretIds).toEqual(['nebula_new']);
  });

  it('updates an already delegated secret in place', async () => {
    let result = await writeBackendSecrets({
      backend: backend({ clientSecretNebulaSecretId: 'nebula_1' }),
      secrets: { clientSecret: 'rotated' }
    });

    expect(result.patch).toEqual({});
    expect(mocks.nebula.update).toHaveBeenCalledWith(
      expect.objectContaining({
        secretId: 'nebula_1',
        secret: JSON.stringify({ value: 'rotated' })
      })
    );
  });

  it('leaves fields that were not provided untouched', async () => {
    let result = await writeBackendSecrets({ backend: backend(), secrets: {} });

    expect(result.patch).toEqual({});
    expect(mocks.nebula.create).not.toHaveBeenCalled();
  });

  it('keeps default backends local', async () => {
    let result = await writeBackendSecrets({
      backend: backend({ tenantOid: null }),
      secrets: { clientSecret: 'secret' }
    });

    expect(result.patch).toEqual({ clientSecret: 'secret' });
    expect(mocks.nebula.create).not.toHaveBeenCalled();
  });

  it('writes locally while delegation is off', async () => {
    mocks.delegate.enabled = false;

    let result = await writeBackendSecrets({
      backend: backend(),
      secrets: { appPrivateKey: 'key' }
    });

    expect(result.patch).toEqual({ appPrivateKey: 'key' });
  });

  it('caches stable secrets in memory until they are rewritten', async () => {
    mocks.nebula.use.mockResolvedValue({ plaintext: JSON.stringify({ value: 'remote' }) });
    let delegated = backend({ appWebhookSecretNebulaSecretId: 'nebula_hook' });

    expect(await readBackendSecret(delegated, 'appWebhookSecret', 'note')).toBe('remote');
    expect(await readBackendSecret(delegated, 'appWebhookSecret', 'note')).toBe('remote');
    expect(mocks.nebula.use).toHaveBeenCalledTimes(1);

    await writeBackendSecrets({ backend: delegated, secrets: { appWebhookSecret: 'next' } });
    await readBackendSecret(delegated, 'appWebhookSecret', 'note');
    expect(mocks.nebula.use).toHaveBeenCalledTimes(2);
  });

  it('returns the local value for legacy backends', async () => {
    let legacy = backend({ clientSecret: 'legacy' });

    expect(await readBackendSecret(legacy, 'clientSecret', 'note')).toBe('legacy');
    expect(mocks.nebula.use).not.toHaveBeenCalled();
  });
});

describe('webhook signing secrets', () => {
  it('stores a new signing secret in Nebula', async () => {
    let stored = await stageWebhookSigningSecret({
      tenantOid: 3n,
      webhookId: 'osw_1',
      signingSecret: 'signing'
    });

    expect(stored).toEqual({ signingSecret: null, signingSecretNebulaSecretId: 'nebula_new' });
  });

  it('stores it locally while delegation is off', async () => {
    mocks.delegate.enabled = false;

    let stored = await stageWebhookSigningSecret({
      tenantOid: 3n,
      webhookId: 'osw_1',
      signingSecret: 'signing'
    });

    expect(stored).toEqual({ signingSecret: 'signing', signingSecretNebulaSecretId: null });
  });

  it('reads legacy and delegated signing secrets', async () => {
    mocks.nebula.use.mockResolvedValue({ plaintext: JSON.stringify({ value: 'remote' }) });

    expect(
      await readWebhookSigningSecret(
        { id: 'osw_1', signingSecret: 'local', signingSecretNebulaSecretId: null },
        3n,
        'note'
      )
    ).toBe('local');
    expect(
      await readWebhookSigningSecret(
        { id: 'osw_2', signingSecret: null, signingSecretNebulaSecretId: 'nebula_sign' },
        3n,
        'note'
      )
    ).toBe('remote');
  });
});
