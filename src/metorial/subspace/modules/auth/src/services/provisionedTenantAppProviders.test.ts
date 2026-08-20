import { describe, expect, it, vi } from 'vitest';

process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.DATABASE_URL ??= 'postgres://user:pass@127.0.0.1:5432/task13';
process.env.PUBLIC_SERVICE_URL ??= 'http://subspace.test';
process.env.ENCRYPTION_KEY ??= 'task13-test-encryption-key';

let { ProvisionedAppHubCredentialAuthorityAdapter, ProvisionedAppVendorServiceAdapter } =
  await import('./provisionedTenantAppProviders');

describe('provisioned app production vendor adapter', () => {
  it('uses the signed Hub writer/validator and returns only redacted metadata', async () => {
    let client = {
      validateProvisionedTenantCredentialSecret: vi.fn().mockResolvedValue({ valid: true }),
      createOrRotateProvisionedTenantCredentialSecret: vi.fn().mockResolvedValue({
        secret: { id: 'secret-1', status: 'active', secretVersion: 1 },
        auditCorrelationId: 'audit-1',
        idempotent: false,
        secretIssuanceReceipt: null
      }),
      revokeProvisionedTenantCredentialSecret: vi.fn().mockResolvedValue({
        secret: { id: 'secret-1', status: 'revoked', secretVersion: 1 },
        auditCorrelationId: 'audit-2',
        idempotent: false,
        secretIssuanceReceipt: null
      })
    };
    let adapter = new ProvisionedAppHubCredentialAuthorityAdapter(
      { endpoint: 'https://hub.test/rpc', token: 'signed-token' },
      client
    );
    let written = await adapter.createOrRotate({
      provisionedTenantAppId: 'binding-1',
      importedValue: 'must-never-be-returned'
    });
    expect(written).toMatchObject({
      secret: { id: 'secret-1', status: 'active', secretVersion: 1 },
      secretIssuanceReceipt: null
    });
    expect(JSON.stringify(written)).not.toContain('must-never-be-returned');
    await expect(
      adapter.revoke({ provisionedTenantAppId: 'binding-1' })
    ).resolves.toMatchObject({
      secret: { status: 'revoked' },
      secretIssuanceReceipt: null
    });
  });

  it('uses a GitHub redirect and authenticated HTTP exchange/install/ownership calls', async () => {
    let requests: Array<{ url: string; init: RequestInit }> = [];
    let httpFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      let url = String(input);
      requests.push({ url, init: init ?? {} });
      let payload = url.endsWith('/v1/github/manifests/exchange')
        ? { externalAppId: 'app-1', ownerIdentity: 'organization:metorial' }
        : url.endsWith('/v1/github/installations/resolve')
          ? {
              externalAppId: 'app-1',
              externalInstallationId: 'installation-1',
              externalAccountId: 'account-1',
              ownerIdentity: 'organization:metorial'
            }
          : {
              externalAppId: 'app-1',
              externalInstallationId: 'installation-1',
              ownerIdentity: 'organization:metorial'
            };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    let adapter = new ProvisionedAppVendorServiceAdapter(
      {
        baseUrl: 'https://vendor-authority.test/root/',
        token: 'service-token',
        githubManifestRedirectUrl: 'https://github.com/settings/apps/new'
      },
      httpFetch
    );

    let redirect = new URL(
      adapter.getManifestRedirectUrl({
        state: 'csrf-state',
        provisionedTenantAppId: 'binding-1'
      })
    );
    expect(redirect.origin + redirect.pathname).toBe('https://github.com/settings/apps/new');
    expect(redirect.searchParams.get('state')).toBe('csrf-state');
    expect(redirect.searchParams.get('binding_id')).toBe('binding-1');

    await expect(
      adapter.exchangeManifestCode({
        code: 'manifest-code',
        state: 'csrf-state',
        provisionedTenantAppId: 'binding-1'
      })
    ).resolves.toEqual({
      externalAppId: 'app-1',
      ownerIdentity: 'organization:metorial'
    });
    await expect(
      adapter.resolveInstallation({
        installationCode: 'installation-code',
        expectedAppId: 'app-1'
      })
    ).resolves.toMatchObject({
      externalAppId: 'app-1',
      externalInstallationId: 'installation-1'
    });
    await expect(
      adapter.verify({ vendor: 'github', proof: { signed: true }, expectedAppId: 'app-1' })
    ).resolves.toMatchObject({ externalInstallationId: 'installation-1' });

    expect(requests).toHaveLength(3);
    for (let request of requests) {
      expect(request.init).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer service-token' })
      });
    }
    expect(JSON.parse(String(requests[0]!.init.body))).toEqual({
      code: 'manifest-code',
      state: 'csrf-state',
      provisionedTenantAppId: 'binding-1'
    });
  });

  it('rejects non-GitHub redirect origins', () => {
    expect(
      () =>
        new ProvisionedAppVendorServiceAdapter({
          baseUrl: 'https://vendor-authority.test',
          token: 'service-token',
          githubManifestRedirectUrl: 'https://attacker.example/apps/new'
        })
    ).toThrow('must use https://github.com');
  });
});
