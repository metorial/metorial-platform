import { describe, expect, it } from 'vitest';
import {
  applyClientAuthentication,
  parseTokenEndpointAuthMethod,
  resolveTokenEndpointAuthMethod
} from './tokenEndpointAuth';

let config = {
  authorization_endpoint: 'https://provider.test/authorize',
  token_endpoint: 'https://provider.test/token',
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none']
};

describe('resolveTokenEndpointAuthMethod', () => {
  it('uses the registered method even when the provider supports several', () => {
    expect(
      resolveTokenEndpointAuthMethod({
        config,
        clientSecret: 'secret',
        registeredMethod: 'client_secret_basic'
      })
    ).toBe('client_secret_basic');
  });

  it('falls back to post when both are supported and nothing was registered', () => {
    expect(resolveTokenEndpointAuthMethod({ config, clientSecret: 'secret' })).toBe(
      'client_secret_post'
    );
  });

  it('uses basic when it is the only supported secret method', () => {
    expect(
      resolveTokenEndpointAuthMethod({
        config: { ...config, token_endpoint_auth_methods_supported: ['client_secret_basic'] },
        clientSecret: 'secret'
      })
    ).toBe('client_secret_basic');
  });

  it('treats clients without a secret as public', () => {
    expect(
      resolveTokenEndpointAuthMethod({
        config,
        registeredMethod: 'client_secret_basic'
      })
    ).toBe('none');
  });
});

describe('applyClientAuthentication', () => {
  it('sends basic credentials in the header only', () => {
    let headers: Record<string, string> = {};
    let body = new URLSearchParams();

    applyClientAuthentication({
      method: 'client_secret_basic',
      clientId: 'id',
      clientSecret: 'secret',
      headers,
      body
    });

    expect(headers.Authorization).toBe(`Basic ${btoa('id:secret')}`);
    expect(body.toString()).toBe('');
  });

  it('sends post credentials in the body only', () => {
    let headers: Record<string, string> = {};
    let body = new URLSearchParams();

    applyClientAuthentication({
      method: 'client_secret_post',
      clientId: 'id',
      clientSecret: 'secret',
      headers,
      body
    });

    expect(headers.Authorization).toBeUndefined();
    expect(body.get('client_id')).toBe('id');
    expect(body.get('client_secret')).toBe('secret');
  });

  it('sends only the client id for public clients', () => {
    let body = new URLSearchParams();

    applyClientAuthentication({ method: 'none', clientId: 'id', headers: {}, body });

    expect(body.toString()).toBe('client_id=id');
  });
});

describe('parseTokenEndpointAuthMethod', () => {
  it('rejects unknown values', () => {
    expect(parseTokenEndpointAuthMethod('private_key_jwt')).toBeUndefined();
    expect(parseTokenEndpointAuthMethod(undefined)).toBeUndefined();
    expect(parseTokenEndpointAuthMethod('none')).toBe('none');
  });
});
