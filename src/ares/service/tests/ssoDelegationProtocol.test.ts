import { describe, expect, it } from 'vitest';
import {
  createDelegationCodeChallenge,
  getEffectiveDelegationTokenUrl,
  hashDelegationSecret,
  normalizeDelegationAuthorizationEndpoint,
  validateDelegationRedirectUri
} from '../src/lib/ssoDelegationProtocol';
import { aresPorts } from '../src/ports';

describe('SSO delegation protocol', () => {
  it('creates stable hashes and S256 PKCE challenges', () => {
    expect(hashDelegationSecret('secret')).toHaveLength(64);
    expect(createDelegationCodeChallenge('verifier')).toBe(
      'iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ'
    );
  });

  it('normalizes authorization endpoints without dropping unrelated parameters', () => {
    expect(
      normalizeDelegationAuthorizationEndpoint(
        'https://regional.example/authorize?client_id=a&response_type=b&audience=c#fragment'
      )
    ).toBe('https://regional.example/authorize?audience=c');
  });

  it('replaces only the origin for self-delegation token calls', () => {
    expect(
      getEffectiveDelegationTokenUrl({
        tokenUrl: 'https://regional.example/metorial-ares/sso-delegation/token?version=1',
        localBaseUrl: `http://localhost:${aresPorts.sso}`,
        isSelfDelegation: true
      })
    ).toBe(
      'http://localhost:52122/metorial-ares/sso-delegation/token?version=1'
    );
  });

  it('keeps the public URL for remote delegations', () => {
    expect(
      getEffectiveDelegationTokenUrl({
        tokenUrl: 'https://regional.example/token',
        localBaseUrl: 'http://127.0.0.1:52122',
        isSelfDelegation: false
      })
    ).toBe('https://regional.example/token');
  });

  it('requires HTTPS except for explicitly allowed localhost callbacks', () => {
    expect(
      validateDelegationRedirectUri({
        redirectUri: 'https://global.example/callback',
        allowHttpLocalhost: false
      })
    ).toBe('https://global.example/callback');
    expect(() =>
      validateDelegationRedirectUri({
        redirectUri: 'http://global.example/callback',
        allowHttpLocalhost: true
      })
    ).toThrow('must use HTTPS');
    expect(
      validateDelegationRedirectUri({
        redirectUri: 'http://localhost:52120/callback',
        allowHttpLocalhost: true
      })
    ).toBe('http://localhost:52120/callback');
  });
});
