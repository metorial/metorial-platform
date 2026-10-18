import type { OAuthConfiguration } from './types';

export type TokenEndpointAuthMethod = 'client_secret_basic' | 'client_secret_post' | 'none';

let knownMethods: string[] = ['client_secret_basic', 'client_secret_post', 'none'];

export let parseTokenEndpointAuthMethod = (value: unknown): TokenEndpointAuthMethod | undefined =>
  typeof value === 'string' && knownMethods.includes(value)
    ? (value as TokenEndpointAuthMethod)
    : undefined;

export let resolveTokenEndpointAuthMethod = (d: {
  config: OAuthConfiguration;
  clientSecret?: string;
  registeredMethod?: TokenEndpointAuthMethod;
}): TokenEndpointAuthMethod => {
  if (!d.clientSecret) return 'none';

  if (d.registeredMethod === 'client_secret_basic' || d.registeredMethod === 'client_secret_post') {
    return d.registeredMethod;
  }

  let supported = d.config.token_endpoint_auth_methods_supported;
  let hasBasic = supported?.includes('client_secret_basic');
  let hasPost = supported?.includes('client_secret_post');

  return hasBasic && !hasPost ? 'client_secret_basic' : 'client_secret_post';
};

export let applyClientAuthentication = (d: {
  method: TokenEndpointAuthMethod;
  clientId: string;
  clientSecret?: string;
  headers: Record<string, string>;
  body: URLSearchParams;
}) => {
  if (d.method === 'client_secret_basic' && d.clientSecret) {
    d.headers.Authorization = `Basic ${btoa(`${d.clientId}:${d.clientSecret}`)}`;
    return;
  }

  d.body.set('client_id', d.clientId);
  if (d.method === 'client_secret_post' && d.clientSecret) {
    d.body.set('client_secret', d.clientSecret);
  }
};
