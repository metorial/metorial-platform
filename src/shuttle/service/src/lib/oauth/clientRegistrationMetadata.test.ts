import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  clientBranding: {
    logo_uri: 'https://cdn.test/logo.svg',
    client_uri: 'https://client.test',
    tos_uri: 'https://client.test/legal',
    policy_uri: 'https://client.test/legal'
  }
}));

import {
  buildClientBrandingMetadata,
  buildClientRegistrationMetadata
} from './clientRegistrationMetadata';

describe('buildClientBrandingMetadata', () => {
  it('returns the logo, client, terms of service and policy uris', () => {
    expect(buildClientBrandingMetadata()).toEqual({
      logo_uri: 'https://cdn.test/logo.svg',
      client_uri: 'https://client.test',
      tos_uri: 'https://client.test/legal',
      policy_uri: 'https://client.test/legal'
    });
  });
});

describe('buildClientRegistrationMetadata', () => {
  it('does not include branding fields', () => {
    let metadata = buildClientRegistrationMetadata({
      authorization_endpoint: 'https://provider.test/authorize',
      token_endpoint: 'https://provider.test/token'
    });

    expect(metadata).not.toHaveProperty('logo_uri');
    expect(metadata).not.toHaveProperty('client_uri');
    expect(metadata).not.toHaveProperty('tos_uri');
    expect(metadata).not.toHaveProperty('policy_uri');
  });

  it('picks the supported grant types, response types and auth method', () => {
    let metadata = buildClientRegistrationMetadata({
      authorization_endpoint: 'https://provider.test/authorize',
      token_endpoint: 'https://provider.test/token',
      grant_types_supported: ['authorization_code', 'implicit'],
      response_types_supported: ['code', 'token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none']
    });

    expect(metadata).toEqual({
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post'
    });
  });
});
