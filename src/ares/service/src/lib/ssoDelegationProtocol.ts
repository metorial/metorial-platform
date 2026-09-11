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

export let allowHttpDelegationRedirect =
  process.env.NODE_ENV === 'development' ||
  process.env.METORIAL_ENV === 'development';

export let getDelegationCallbackUri = (authBaseUrl: string) =>
  new URL('/metorial-ares/hooks/sso-delegation-response', authBaseUrl).toString();

export let createDelegationMetadataTokenBody = (d: { redirectUri: string }) =>
  new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'urn:metorial.com:ares:sso-delegation:metadata',
    redirect_uri: d.redirectUri
  });

export let parseDelegationMetadataRedirectUri = (d: {
  redirectUri?: string;
  allowHttpLocalhost: boolean;
}) => {
  if (!d.redirectUri) return null;
  return validateDelegationRedirectUri({
    redirectUri: d.redirectUri,
    allowHttpLocalhost: d.allowHttpLocalhost
  });
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

export let normalizeDelegationRedirectUri = (redirectUri: string) =>
  new URL(redirectUri).toString();

export let FALLBACK_DELEGATION_REDIRECT_URI =
  'https://id.metorial.com/metorial-ares/hooks/sso-delegation-response';

export let getExportedDelegationRedirectUri = (stored?: string | null) =>
  stored ?? FALLBACK_DELEGATION_REDIRECT_URI;

export let pickLatestExportedDelegation = <T extends { updatedAt: Date }>(exports: T[]) => {
  if (exports.length === 0) return null;
  return [...exports].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]!;
};

export let buildIdpInitiatedDelegationRedirect = (d: {
  redirectUri: string;
  code: string;
  clientId: string;
}) => {
  let redirect = new URL(d.redirectUri);
  redirect.searchParams.set('code', d.code);
  redirect.searchParams.set('client_id', d.clientId);
  return redirect.toString();
};

export let resolveIdpInitiatedSamlCompletion = (d: {
  exportedDelegations: { updatedAt: Date; redirectUri: string | null; clientId: string }[];
}) => {
  let exported = pickLatestExportedDelegation(d.exportedDelegations);
  if (!exported) return { type: 'local' as const };
  return {
    type: 'delegated' as const,
    clientId: exported.clientId,
    redirectUri: getExportedDelegationRedirectUri(exported.redirectUri)
  };
};

export let getDelegationResponseMode = (d: {
  code?: string | null;
  state?: string | null;
  clientId?: string | null;
}) => {
  if (!d.code) return { type: 'invalid' as const, reason: 'missing_code' as const };
  if (d.state) return { type: 'sp_initiated' as const };
  if (d.clientId) return { type: 'idp_initiated' as const };
  return { type: 'invalid' as const, reason: 'missing_state_or_client_id' as const };
};

export let getIdpInitiatedConsumerLoginRedirect = (d: {
  defaultRedirectUrl: string;
  authorizationCode: string;
}) => {
  let redirect = new URL(d.defaultRedirectUrl);
  redirect.searchParams.set('code', d.authorizationCode);
  return redirect.toString();
};

export let assertDelegationAuthorizationCodeVerifier = (d: {
  codeChallenge: string | null;
  codeVerifier?: string;
}) => {
  if (!d.codeChallenge) return;
  if (!d.codeVerifier || createDelegationCodeChallenge(d.codeVerifier) !== d.codeChallenge) {
    throw new Error('Invalid PKCE verifier');
  }
};

export let assertDelegationAuthorizationGrant = (d: {
  storedRedirectUri: string;
  presentedRedirectUri: string;
  codeChallenge: string | null;
  codeVerifier?: string;
}) => {
  let presented: string;
  try {
    presented = normalizeDelegationRedirectUri(d.presentedRedirectUri);
  } catch {
    throw new Error('Invalid authorization code');
  }
  if (d.storedRedirectUri !== presented) {
    throw new Error('Invalid authorization code');
  }
  assertDelegationAuthorizationCodeVerifier({
    codeChallenge: d.codeChallenge,
    codeVerifier: d.codeVerifier
  });
};
