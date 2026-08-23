import { describe, expect, it } from 'vitest';
import { buildClientRegistrationMetadata } from './clientRegistrationMetadata';
import type { OAuthConfiguration } from './types';

let config = (partial: Partial<OAuthConfiguration> = {}): OAuthConfiguration => ({
  authorization_endpoint: 'https://example.com/oauth2/authorize',
  token_endpoint: 'https://example.com/oauth2/token',
  registration_endpoint: 'https://example.com/oauth2/register',
  ...partial
});

describe('buildClientRegistrationMetadata', () => {
  it('drops grant types we never use', () => {
    let metadata = buildClientRegistrationMetadata(
      config({
        grant_types_supported: [
          'authorization_code',
          'refresh_token',
          'urn:ietf:params:oauth:grant-type:device_code',
          'urn:ietf:params:oauth:grant-type:jwt-bearer'
        ],
        response_types_supported: ['code'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic']
      })
    );

    expect(metadata).toEqual({
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic'
    });
  });

  it('drops response types we never use', () => {
    let metadata = buildClientRegistrationMetadata(
      config({ response_types_supported: ['code', 'token', 'id_token'] })
    );

    expect(metadata.response_types).toEqual(['code']);
  });

  it('omits flows the server does not advertise', () => {
    let metadata = buildClientRegistrationMetadata(
      config({ grant_types_supported: ['authorization_code'] })
    );

    expect(metadata.grant_types).toEqual(['authorization_code']);
    expect(metadata.response_types).toBeUndefined();
  });

  it('falls back to server defaults when nothing overlaps', () => {
    let metadata = buildClientRegistrationMetadata(
      config({ grant_types_supported: ['client_credentials'] })
    );

    expect(metadata.grant_types).toBeUndefined();
  });

  it('registers as a public client when secrets are unsupported', () => {
    let metadata = buildClientRegistrationMetadata(
      config({ token_endpoint_auth_methods_supported: ['none'] })
    );

    expect(metadata.token_endpoint_auth_method).toBe('none');
  });

  it('keeps client_secret_basic when the server advertises no auth methods', () => {
    expect(buildClientRegistrationMetadata(config()).token_endpoint_auth_method).toBe(
      'client_secret_basic'
    );
  });
});
