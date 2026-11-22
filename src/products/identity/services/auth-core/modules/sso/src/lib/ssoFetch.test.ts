import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  safeFetch: vi.fn(),
  assertUrlIpAllowed: vi.fn()
}));

vi.mock('@lowerdeck/ssrf', async importOriginal => ({
  ...(await importOriginal<typeof import('@lowerdeck/ssrf')>()),
  safeFetch: mocks.safeFetch,
  assertUrlIpAllowed: mocks.assertUrlIpAllowed
}));

let original = { ...process.env };

let load = async (env: Record<string, string> = {}) => {
  vi.resetModules();
  process.env = { ...original, ...env };
  delete process.env.METORIAL_EDITION;
  delete process.env.METORIAL_ENV;
  if (env.METORIAL_EDITION) process.env.METORIAL_EDITION = env.METORIAL_EDITION;
  if (env.METORIAL_ENV) process.env.METORIAL_ENV = env.METORIAL_ENV;

  return {
    ...(await import('./ssoFetch')),
    ssrf: await import('@lowerdeck/ssrf')
  };
};

beforeEach(() => {
  mocks.safeFetch
    .mockReset()
    .mockImplementation(async () => new Response('<EntityDescriptor/>'));
  mocks.assertUrlIpAllowed.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...original };
});

describe('fetchSsoMetadata', () => {
  it('only reaches public addresses by default in the cloud edition', async () => {
    let { fetchSsoMetadata, ssrf } = await load();

    await expect(fetchSsoMetadata('https://idp.example.test/metadata')).resolves.toBe(
      '<EntityDescriptor/>'
    );
    expect(mocks.safeFetch).toHaveBeenCalledWith(
      'https://idp.example.test/metadata',
      expect.objectContaining({ isIpAllowed: ssrf.isPublicIp })
    );
  });

  it('reaches private networks by default in the on-prem edition', async () => {
    let { fetchSsoMetadata } = await load({ METORIAL_EDITION: 'on-prem' });

    await fetchSsoMetadata('https://idp.corp.internal/metadata');

    expect(mocks.safeFetch).toHaveBeenCalledWith(
      'https://idp.corp.internal/metadata',
      expect.objectContaining({ isIpAllowed: false })
    );
  });

  it('reaches private networks when the installation opts in or runs in development', async () => {
    let environments: Record<string, string>[] = [
      { SSO_ALLOW_PRIVATE_NETWORKS: 'true' },
      { METORIAL_ENV: 'development' }
    ];

    for (let env of environments) {
      mocks.safeFetch.mockClear();
      let { fetchSsoMetadata } = await load(env);

      await fetchSsoMetadata('http://127.0.0.1:4010/metadata');

      expect(mocks.safeFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:4010/metadata',
        expect.objectContaining({ isIpAllowed: false })
      );
    }
  });

  it('reports a blocked address without fetching details', async () => {
    let { fetchSsoMetadata, ssrf } = await load();
    mocks.safeFetch.mockRejectedValueOnce(new ssrf.SsrfBlockedError());

    await expect(fetchSsoMetadata('https://idp.example.test/metadata')).rejects.toMatchObject({
      message: expect.stringContaining('not reachable')
    });
  });

  it('reports fetch failures and error statuses with one generic message', async () => {
    let { fetchSsoMetadata } = await load();

    mocks.safeFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED 203.0.113.9:8443'));
    let refused = await fetchSsoMetadata('https://idp.example.test/metadata').catch(e => e);

    mocks.safeFetch.mockResolvedValueOnce(new Response('internal detail', { status: 500 }));
    let failed = await fetchSsoMetadata('https://idp.example.test/metadata').catch(e => e);

    expect(refused.message).toContain('Could not fetch the identity provider metadata');
    expect(failed.message).toBe(refused.message);
    expect(refused.message).not.toContain('203.0.113.9');
  });

  it('rejects metadata above the size limit', async () => {
    let { fetchSsoMetadata } = await load();
    mocks.safeFetch.mockResolvedValueOnce(new Response('x'.repeat(1_000_001)));

    await expect(fetchSsoMetadata('https://idp.example.test/metadata')).rejects.toMatchObject({
      message: expect.stringContaining('too large')
    });
  });

  it('rejects URLs that are not HTTPS, carry credentials or cannot be parsed', async () => {
    let { fetchSsoMetadata } = await load();

    for (let url of [
      'http://idp.example.test/metadata',
      'file:///etc/passwd',
      'gopher://idp.example.test/',
      'https://user:pass@idp.example.test/metadata',
      'not a url'
    ]) {
      await expect(fetchSsoMetadata(url), url).rejects.toMatchObject({
        message: expect.stringContaining('identity provider URL')
      });
    }

    expect(mocks.safeFetch).not.toHaveBeenCalled();
  });
});

describe('assertSsoUrlReachable', () => {
  it('checks the address unless private networks are allowed', async () => {
    let cloud = await load();
    await cloud.assertSsoUrlReachable(
      'https://idp.example.test/.well-known/openid-configuration'
    );
    expect(mocks.assertUrlIpAllowed).toHaveBeenCalledWith(
      'https://idp.example.test/.well-known/openid-configuration'
    );

    mocks.assertUrlIpAllowed.mockClear();

    let onPrem = await load({ METORIAL_EDITION: 'on-prem' });
    await onPrem.assertSsoUrlReachable(
      'https://idp.corp.internal/.well-known/openid-configuration'
    );
    expect(mocks.assertUrlIpAllowed).not.toHaveBeenCalled();
  });

  it('reports blocked and unresolvable addresses the same way', async () => {
    let { assertSsoUrlReachable, ssrf } = await load();

    mocks.assertUrlIpAllowed.mockRejectedValueOnce(new ssrf.SsrfBlockedError());
    let blocked = await assertSsoUrlReachable('https://metadata.internal/latest').catch(
      e => e
    );

    mocks.assertUrlIpAllowed.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));
    let unresolved = await assertSsoUrlReachable('https://missing.example.test/').catch(
      e => e
    );

    expect(blocked.message).toContain('not reachable');
    expect(unresolved.message).toBe(blocked.message);
  });

  it('rejects plain HTTP for hosts other than the local machine', async () => {
    let { assertSsoUrlReachable } = await load();

    await expect(
      assertSsoUrlReachable('http://idp.example.test/.well-known/openid-configuration')
    ).rejects.toMatchObject({ message: expect.stringContaining('HTTPS') });
    expect(mocks.assertUrlIpAllowed).not.toHaveBeenCalled();
  });
});
