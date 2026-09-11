import { describe, expect, it } from 'vitest';
import {
  assertDelegationAuthorizationGrant,
  buildIdpInitiatedDelegationRedirect,
  createDelegationCodeChallenge,
  createDelegationMetadataTokenBody,
  FALLBACK_DELEGATION_REDIRECT_URI,
  getDelegationCallbackUri,
  getDelegationResponseMode,
  getEffectiveDelegationTokenUrl,
  getExportedDelegationRedirectUri,
  getIdpInitiatedConsumerLoginRedirect,
  hashDelegationSecret,
  normalizeDelegationAuthorizationEndpoint,
  normalizeDelegationRedirectUri,
  pickLatestExportedDelegation,
  resolveIdpInitiatedSamlCompletion
} from '../src/lib/ssoDelegationProtocol';

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

  it('keeps the public URL for remote delegations', () => {
    expect(
      getEffectiveDelegationTokenUrl({
        tokenUrl: 'https://regional.example/token',
        localBaseUrl: 'http://127.0.0.1:52122',
        isSelfDelegation: false
      })
    ).toBe('https://regional.example/token');
  });

  it('canonicalizes redirect URIs before binding authorization codes', () => {
    expect(normalizeDelegationRedirectUri('https://GLOBAL.example:443/callback')).toBe(
      'https://global.example/callback'
    );
  });

  it('builds the consumer delegation callback from the local auth origin', () => {
    expect(getDelegationCallbackUri('https://id.metorial.com')).toBe(
      'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response'
    );
    expect(getDelegationCallbackUri('https://id.metorial.com/')).toBe(
      'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response'
    );
  });

  it('includes the consumer callback when discovering delegation metadata', () => {
    let body = createDelegationMetadataTokenBody({
      redirectUri: getDelegationCallbackUri('https://id.metorial.com')
    });
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('scope')).toBe('urn:metorial.com:ares:sso-delegation:metadata');
    expect(body.get('redirect_uri')).toBe(
      'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response'
    );
  });

  it('falls back to the dashboard delegation callback when an export has no stored URI', () => {
    expect(getExportedDelegationRedirectUri(null)).toBe(
      'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response'
    );
    expect(getExportedDelegationRedirectUri(undefined)).toBe(FALLBACK_DELEGATION_REDIRECT_URI);
    expect(
      getExportedDelegationRedirectUri(
        'https://auth.horizon.test/metorial-ares/hooks/sso-delegation-response'
      )
    ).toBe('https://auth.horizon.test/metorial-ares/hooks/sso-delegation-response');
  });

  it('picks the most recently updated export for IdP-initiated completion', () => {
    let older = {
      clientId: 'old',
      redirectUri: 'https://old.example/callback',
      updatedAt: new Date('2026-01-01')
    };
    let newer = {
      clientId: 'new',
      redirectUri: 'https://new.example/callback',
      updatedAt: new Date('2026-08-01')
    };

    expect(pickLatestExportedDelegation([])).toBeNull();
    expect(pickLatestExportedDelegation([older, newer])).toBe(newer);
  });

  it('keeps IdP-initiated SAML local when the tenant has no exports', () => {
    expect(resolveIdpInitiatedSamlCompletion({ exportedDelegations: [] })).toEqual({
      type: 'local'
    });
  });

  it('routes IdP-initiated SAML through delegated auth and ignores app defaultRedirectUrl', () => {
    let completion = resolveIdpInitiatedSamlCompletion({
      exportedDelegations: [
        {
          clientId: 'sso_del_client_1',
          redirectUri: null,
          updatedAt: new Date('2026-08-01')
        }
      ]
    });

    expect(completion).toEqual({
      type: 'delegated',
      clientId: 'sso_del_client_1',
      redirectUri: FALLBACK_DELEGATION_REDIRECT_URI
    });

    if (completion.type !== 'delegated') throw new Error('expected delegated');
    let redirect = buildIdpInitiatedDelegationRedirect({
      redirectUri: completion.redirectUri,
      code: 'delegation-code',
      clientId: completion.clientId
    });
    let url = new URL(redirect);
    expect(url.origin + url.pathname).toBe(
      'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response'
    );
    expect(url.searchParams.get('code')).toBe('delegation-code');
    expect(url.searchParams.get('client_id')).toBe('sso_del_client_1');
    expect(redirect.includes('ares:52123')).toBe(false);
  });

  it('requires PKCE only when the authorization code has a challenge', () => {
    expect(() =>
      assertDelegationAuthorizationGrant({
        storedRedirectUri:
          'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response',
        presentedRedirectUri:
          'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response',
        codeChallenge: null
      })
    ).not.toThrow();

    expect(() =>
      assertDelegationAuthorizationGrant({
        storedRedirectUri:
          'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response',
        presentedRedirectUri:
          'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response',
        codeChallenge: createDelegationCodeChallenge('verifier'),
        codeVerifier: 'verifier'
      })
    ).not.toThrow();

    expect(() =>
      assertDelegationAuthorizationGrant({
        storedRedirectUri:
          'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response',
        presentedRedirectUri:
          'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response',
        codeChallenge: createDelegationCodeChallenge('verifier')
      })
    ).toThrow('Invalid PKCE verifier');

    expect(() =>
      assertDelegationAuthorizationGrant({
        storedRedirectUri:
          'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response',
        presentedRedirectUri: 'https://evil.example/callback',
        codeChallenge: null
      })
    ).toThrow('Invalid authorization code');
  });

  it('classifies sso-delegation-response as SP-initiated or IdP-initiated', () => {
    expect(getDelegationResponseMode({ code: 'c', state: 's' })).toEqual({
      type: 'sp_initiated'
    });
    expect(getDelegationResponseMode({ code: 'c', clientId: 'client' })).toEqual({
      type: 'idp_initiated'
    });
    expect(getDelegationResponseMode({ clientId: 'client' })).toEqual({
      type: 'invalid',
      reason: 'missing_code'
    });
    expect(getDelegationResponseMode({ code: 'c' })).toEqual({
      type: 'invalid',
      reason: 'missing_state_or_client_id'
    });
  });

  it('completes IdP-initiated consumer login against the imported app callback', () => {
    let redirect = getIdpInitiatedConsumerLoginRedirect({
      defaultRedirectUrl: 'https://metorial.com',
      authorizationCode: 'session-code'
    });
    let url = new URL(redirect);
    expect(url.origin + url.pathname).toBe('https://metorial.com/');
    expect(url.searchParams.get('code')).toBe('session-code');
    expect(redirect.includes('ares:52123')).toBe(false);
  });
});
