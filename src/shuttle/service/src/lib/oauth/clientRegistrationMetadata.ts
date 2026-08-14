import type { OAuthConfiguration } from './types';

let usableGrantTypes = ['authorization_code', 'refresh_token'];
let usableResponseTypes = ['code'];
let authMethodPreference = ['client_secret_basic', 'client_secret_post', 'none'];

let supportedSubset = (usable: string[], supported: string[] | undefined) => {
  if (!supported?.length) return undefined;

  let subset = usable.filter(value => supported.includes(value));

  return subset.length ? subset : undefined;
};

export let buildClientRegistrationMetadata = (config: OAuthConfiguration) => ({
  grant_types: supportedSubset(usableGrantTypes, config.grant_types_supported),
  response_types: supportedSubset(usableResponseTypes, config.response_types_supported),
  token_endpoint_auth_method:
    authMethodPreference.find(method =>
      config.token_endpoint_auth_methods_supported?.includes(method)
    ) ?? 'client_secret_basic'
});
