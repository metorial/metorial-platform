import { createHash } from 'crypto';

export let hashDelegationSecret = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export let createDelegationCodeChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

export let normalizeDelegationAuthorizationEndpoint = (
  authorizationUrl: string
) => {
  let url = new URL(authorizationUrl);
  url.searchParams.delete('client_id');
  url.searchParams.delete('response_type');
  url.hash = '';
  return url.toString();
};

export let getEffectiveDelegationTokenUrl = (d: {
  tokenUrl: string;
  localBaseUrl?: string;
  isSelfDelegation: boolean;
}) => {
  let remote = new URL(d.tokenUrl);
  if (!d.isSelfDelegation || !d.localBaseUrl) return remote.toString();

  let local = new URL(d.localBaseUrl);
  remote.protocol = local.protocol;
  remote.host = local.host;
  return remote.toString();
};

export let validateDelegationRedirectUri = (d: {
  redirectUri: string;
  allowHttpLocalhost: boolean;
}) => {
  let url = new URL(d.redirectUri);
  if (
    url.protocol !== 'https:' &&
    !(
      d.allowHttpLocalhost &&
      url.protocol === 'http:' &&
      url.hostname === 'localhost'
    )
  ) {
    throw new Error('Delegation redirect_uri must use HTTPS');
  }
  if (url.username || url.password || url.hash) {
    throw new Error('Invalid delegation redirect_uri');
  }
  return url.toString();
};
