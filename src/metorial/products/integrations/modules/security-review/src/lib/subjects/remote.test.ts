import { describe, expect, it, vi } from 'vitest';
import { buildRemoteEvidence, normalizeReviewUrl } from './remote';

vi.mock('@metorial-subspace/module-protoguard', async () => {
  let { containsTokenForReview } = await import('../../../../protoguard/src/lib/reviewScan');
  return { containsTokenForReview };
});

let GITHUB_TOKEN = ['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('');

describe('normalizeReviewUrl', () => {
  it('preserves endpoint paths, fragments, ordinary queries and their order', () => {
    expect(
      normalizeReviewUrl('HTTPS://MCP.VENDOR.COM:443/Api/mcp/?b=two&a=hello%20world&a=3#docs')
    ).toEqual({
      url: 'https://mcp.vendor.com/Api/mcp/?b=two&a=hello%20world&a=3#docs',
      host: 'mcp.vendor.com',
      httpsEnabled: true
    });
  });

  it('screens every decoded query value and preserves repeated parameters', () => {
    let input = `https://vendor.com/mcp?scope=documents%3Aread&value=${encodeURIComponent(`Bearer ${GITHUB_TOKEN}`)}&scope=documents%3Awrite&value=public&opaque=aB3dE6gH9jK2mN5pQ8sT1vW4`;
    let normalized = normalizeReviewUrl(input)!;
    let url = new URL(normalized.url);

    expect([...url.searchParams]).toEqual([
      ['scope', 'documents:read'],
      ['value', '[REDACTED]'],
      ['scope', 'documents:write'],
      ['value', 'public'],
      ['opaque', '[REDACTED]']
    ]);
    expect(normalized.url).not.toContain(GITHUB_TOKEN);
  });

  it('accepts HTTP and explicitly identifies unencrypted transport', () => {
    expect(normalizeReviewUrl('http://localhost:8080/mcp')).toEqual({
      url: 'http://localhost:8080/mcp',
      host: 'localhost',
      httpsEnabled: false
    });
  });

  it.each([
    'invalid endpoint secret',
    'ftp://vendor.com/mcp',
    'https://user:password@vendor.com/mcp'
  ])('omits invalid or credential-bearing URLs: %s', value => {
    expect(normalizeReviewUrl(value)).toBeNull();
  });
});

describe('buildRemoteEvidence', () => {
  it('projects public OAuth metadata and screens all endpoint URLs', () => {
    let evidence = buildRemoteEvidence({
      type: 'remote',
      remoteUrl: `https://vendor.com/mcp?value=${GITHUB_TOKEN}&region=eu`,
      protocol: 'streamable_http',
      oauthConfig: {
        issuer: 'https://auth.vendor.com/',
        authorization_endpoint: `https://auth.vendor.com/authorize?value=${GITHUB_TOKEN}`,
        token_endpoint: 'http://auth.vendor.com/token',
        userinfo_endpoint: 'https://auth.vendor.com/userinfo',
        registration_endpoint: 'https://auth.vendor.com/register',
        resource: 'https://vendor.com/mcp',
        authorization_servers: [
          `https://auth.vendor.com/?value=${GITHUB_TOKEN}`,
          'http://auth.vendor.com/'
        ],
        scopes: ['documents:read'],
        scopes_supported: ['documents:read', 'documents:write'],
        response_types_supported: ['code'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        bearer_methods_supported: ['header'],
        pkce_required: true,
        client_secret: 'private-client-secret',
        headers: { Authorization: 'private-header' },
        extra: [{ token: 'private-nested-token' }],
        arbitrary_url: 'https://private-config.example/'
      }
    });
    let remote = JSON.parse(evidence.files['remote.json']);

    expect(remote.httpsEnabled).toBe(true);
    expect(remote.oauth).toMatchObject({
      configured: true,
      issuer: 'https://auth.vendor.com/',
      token_endpoint: 'http://auth.vendor.com/token',
      scopes: ['documents:read'],
      scopes_supported: ['documents:read', 'documents:write'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
      code_challenge_methods_supported: ['S256'],
      pkce_required: true
    });
    expect(new URL(remote.url).searchParams.get('value')).toBe('[REDACTED]');
    expect(new URL(remote.oauth.authorization_endpoint).searchParams.get('value')).toBe(
      '[REDACTED]'
    );
    expect(new URL(remote.oauth.authorization_servers[0]).searchParams.get('value')).toBe(
      '[REDACTED]'
    );
    expect(remote.warnings).toEqual([
      'oauth.token_endpoint does not use HTTPS; transport is not encrypted.',
      'oauth.authorization_servers[1] does not use HTTPS; transport is not encrypted.'
    ]);

    let serialized = JSON.stringify(evidence);
    for (let secret of [
      GITHUB_TOKEN,
      'private-client-secret',
      'private-header',
      'private-nested-token',
      'private-config.example'
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(evidence.facts[0]?.detail).toContain(remote.url);
  });

  it('includes the HTTP warning in both evidence and facts without rejecting the endpoint', () => {
    let evidence = buildRemoteEvidence({
      type: 'remote',
      remoteUrl: 'http://vendor.com/mcp',
      protocol: 'sse'
    });
    let remote = JSON.parse(evidence.files['remote.json']);

    expect(remote).toMatchObject({
      url: 'http://vendor.com/mcp',
      httpsEnabled: false,
      oauth: null
    });
    expect(remote.warnings).toContain('url does not use HTTPS; transport is not encrypted.');
    expect(evidence.facts[0]?.detail).toContain('does not use HTTPS');
  });

  it('drops malformed metadata and never echoes invalid URLs or arbitrary nested values', () => {
    let evidence = buildRemoteEvidence({
      type: 'remote',
      remoteUrl: 'invalid-private-url',
      protocol: 'sse',
      oauthConfig: {
        issuer: 'https://user:private-password@auth.vendor.com/',
        token_endpoint: 'invalid-private-oauth-url',
        scopes_supported: [{ token: 'private-nested-value' }],
        grant_types_supported: ['authorization_code'],
        pkce_required: 'private-not-a-boolean'
      }
    });
    let remote = JSON.parse(evidence.files['remote.json']);

    expect(remote.url).toBeNull();
    expect(remote.oauth).toEqual({
      configured: true,
      grant_types_supported: ['authorization_code']
    });
    expect(remote.warnings).toHaveLength(3);
    expect(JSON.stringify(evidence)).not.toContain('private-');
  });
});
