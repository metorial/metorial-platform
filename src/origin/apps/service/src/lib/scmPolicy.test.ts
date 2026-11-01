import { afterEach, describe, expect, it, vi } from 'vitest';

let original = { ...process.env };

let load = async (types?: string, domains?: string, edition = 'on-prem') => {
  vi.resetModules();
  process.env.METORIAL_EDITION = edition;
  delete process.env.ORIGIN_SCM_ALLOWED_PROVIDER_TYPES;
  delete process.env.ORIGIN_SCM_ALLOWED_DOMAINS;
  if (types !== undefined) process.env.ORIGIN_SCM_ALLOWED_PROVIDER_TYPES = types;
  if (domains !== undefined) process.env.ORIGIN_SCM_ALLOWED_DOMAINS = domains;

  return await import('./scmPolicy');
};

let backend = {
  type: 'github_enterprise' as const,
  tenantOid: 1n,
  isDefault: false,
  webUrl: 'https://git.example.com',
  apiUrl: 'https://git.example.com/api/v3'
};

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe('on-prem SCM policy', () => {
  it('offers all six variants without operator restrictions', async () => {
    let policy = await load();
    expect(policy.getScmProviderOptions()).toHaveLength(6);
    expect(() => policy.assertScmBackendAllowed(backend)).not.toThrow();
  });

  it.each(['[]', ''])(
    'disables every provider with an explicit empty type list %s',
    async types => {
      let policy = await load(types);
      expect(policy.getScmProviderOptions()).toEqual([]);
      expect(() => policy.assertScmBackendAllowed(backend)).toThrow(/disabled/);
    }
  );

  it('selects types and normalizes exact domain names', async () => {
    let policy = await load('github_enterprise,gitlab', 'GIT.EXAMPLE.COM., gitlab.com');
    expect(policy.getScmProviderOptions().map(option => option.type)).toEqual([
      'github_enterprise',
      'gitlab'
    ]);
    expect(() => policy.assertScmBackendAllowed(backend)).not.toThrow();
    expect(() =>
      policy.assertScmBackendAllowed({ ...backend, webUrl: 'https://sub.git.example.com' })
    ).toThrow(/domain/);
    expect(() =>
      policy.assertScmBackendAllowed({
        ...backend,
        apiUrl: 'https://elsewhere.example.com/api/v3'
      })
    ).toThrow(/domain/);
  });

  it('locks hosted provider URLs and maps their official API domains', async () => {
    let policy = await load('github', '["github.com"]');
    let github = {
      ...backend,
      type: 'github' as const,
      webUrl: 'https://github.com',
      apiUrl: 'https://api.github.com'
    };
    expect(() => policy.assertScmBackendAllowed(github)).not.toThrow();
    expect(() =>
      policy.assertScmBackendAllowed({ ...github, apiUrl: backend.apiUrl })
    ).toThrow(/official/);
  });

  it('accepts IDNA domains and preserves self-hosted ports and installation paths', async () => {
    let policy = await load(undefined, '["bücher.example"]');
    expect(policy.normalizeScmDomain('BÜCHER.example.')).toBe('xn--bcher-kva.example');
    let urls = policy.normalizeScmBackendUrls(
      'bitbucket_data_center',
      'https://bücher.example:8443/bitbucket/rest/api/1.0'
    );
    expect(urls.webUrl).toBe('https://xn--bcher-kva.example:8443/bitbucket');
    expect(urls.apiUrl).toBe('https://xn--bcher-kva.example:8443/bitbucket/rest/api/1.0');
    expect(() =>
      policy.assertScmBackendAllowed({ ...backend, ...urls, type: 'bitbucket_data_center' })
    ).not.toThrow();
  });

  it('allows no domains when an empty domain list is configured', async () => {
    let policy = await load(undefined, '[]');
    expect(policy.getScmProviderOptions()).toEqual([]);
    expect(() => policy.assertScmBackendAllowed(backend)).toThrow(/domain/);
  });

  it.each([
    '*.example.com',
    'https://example.com',
    'example.com:443',
    'user@example.com',
    'example.com/path',
    '-invalid.example'
  ])('rejects malformed domain locks: %s', async domain => {
    await expect(load(undefined, JSON.stringify([domain]))).rejects.toThrow(
      /ORIGIN_SCM_ALLOWED_DOMAINS/
    );
  });

  it('rejects unknown provider types', async () => {
    await expect(load('unknown')).rejects.toThrow(/ORIGIN_SCM_ALLOWED_PROVIDER_TYPES/);
  });

  it('rejects global defaults and absent backends instead of using environment credentials', async () => {
    let policy = await load();
    expect(() => policy.assertScmBackendAllowed()).toThrow(/Configure/);
    expect(() => policy.assertScmBackendAllowed({ ...backend, isDefault: true })).toThrow(
      /Configure/
    );
    expect(() => policy.assertScmBackendAllowed({ ...backend, tenantOid: null })).toThrow(
      /Configure/
    );
  });

  it('returns a structured, non-retryable error for existing disallowed backends', async () => {
    let policy = await load('gitlab');
    try {
      policy.assertScmBackendAllowed(backend);
    } catch (error) {
      expect(error).toMatchObject({
        name: 'UnrecoverableError',
        data: { status: 403, code: 'scm_policy_denied' }
      });
      return;
    }
    throw new Error('Expected policy rejection');
  });

  it('ignores operator locks in cloud and retains its three setup choices', async () => {
    let policy = await load('[]', '["*.invalid"]', 'cloud');
    expect(policy.getScmProviderOptions().map(option => option.type)).toEqual([
      'github_enterprise',
      'gitlab_selfhosted',
      'bitbucket_data_center'
    ]);
    expect(() => policy.assertScmBackendAllowed()).not.toThrow();
    expect(() => policy.assertScmBackendAllowed(backend)).not.toThrow();
  });
});
