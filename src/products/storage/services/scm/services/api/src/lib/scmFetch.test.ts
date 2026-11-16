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
  if (env.METORIAL_EDITION) process.env.METORIAL_EDITION = env.METORIAL_EDITION;

  return {
    ...(await import('./scmFetch')),
    ssrf: await import('@lowerdeck/ssrf')
  };
};

beforeEach(() => {
  mocks.safeFetch.mockReset().mockResolvedValue(new Response('ok'));
  mocks.assertUrlIpAllowed.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...original };
});

describe('scmFetch', () => {
  it('only allows public addresses by default in the cloud edition', async () => {
    let { scmFetch, ssrf } = await load();

    await scmFetch(new URL('https://gitlab.example.test/oauth/token'), { method: 'POST' });

    expect(mocks.safeFetch).toHaveBeenCalledWith(
      'https://gitlab.example.test/oauth/token',
      expect.objectContaining({ method: 'POST', isIpAllowed: ssrf.isPublicIp })
    );
  });

  it('allows private networks by default in the on-prem edition', async () => {
    let { scmFetch } = await load({ METORIAL_EDITION: 'on-prem' });

    await scmFetch('http://10.0.0.5/api/v4/user');

    expect(mocks.safeFetch).toHaveBeenCalledWith(
      'http://10.0.0.5/api/v4/user',
      expect.objectContaining({ isIpAllowed: false })
    );
  });

  it('allows private networks when the installation opts in', async () => {
    let { scmFetch } = await load({ ORIGIN_SCM_ALLOW_PRIVATE_NETWORKS: 'true' });

    await scmFetch('http://10.0.0.5/api/v4/user');

    expect(mocks.safeFetch).toHaveBeenCalledWith(
      'http://10.0.0.5/api/v4/user',
      expect.objectContaining({ isIpAllowed: false })
    );
  });

  it('reports a blocked address as a policy error', async () => {
    let { scmFetch, ssrf } = await load();
    mocks.safeFetch.mockRejectedValueOnce(new ssrf.SsrfBlockedError());

    await expect(scmFetch('https://gitlab.example.test')).rejects.toMatchObject({
      name: 'UnrecoverableError',
      message: expect.stringContaining('not reachable')
    });
  });
});

describe('assertScmUrlsReachable', () => {
  it('checks every URL unless private networks are allowed', async () => {
    let { assertScmUrlsReachable } = await load();
    await assertScmUrlsReachable('https://a.example.test', 'https://b.example.test');
    expect(mocks.assertUrlIpAllowed).toHaveBeenCalledTimes(2);

    mocks.assertUrlIpAllowed.mockClear();

    let onPrem = await load({ METORIAL_EDITION: 'on-prem' });
    await onPrem.assertScmUrlsReachable('http://10.0.0.5');
    expect(mocks.assertUrlIpAllowed).not.toHaveBeenCalled();
  });
});

describe('assertScmBackendUrlsValid', () => {
  it('rejects non-http schemes, credentials and internal hosts', async () => {
    let { assertScmBackendUrlsValid } = await load();

    for (let url of [
      'file:///etc/passwd',
      'https://user:pass@gitlab.example.test',
      'http://localhost:8080',
      'http://gitlab.localhost',
      'http://127.0.0.1',
      'http://169.254.169.254/latest',
      'http://[::1]/'
    ]) {
      expect(() => assertScmBackendUrlsValid(url), url).toThrow(/publicly reachable/);
    }

    expect(() =>
      assertScmBackendUrlsValid('https://gitlab.example.test', 'https://93.184.216.34/api/v4')
    ).not.toThrow();
  });

  it('accepts private hosts when private networks are allowed', async () => {
    let { assertScmBackendUrlsValid } = await load({ METORIAL_EDITION: 'on-prem' });

    expect(() =>
      assertScmBackendUrlsValid('http://10.0.0.5', 'http://localhost')
    ).not.toThrow();
    expect(() => assertScmBackendUrlsValid('ftp://10.0.0.5')).toThrow();
  });
});
