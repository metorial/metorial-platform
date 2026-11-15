import { v } from '@lowerdeck/validation';
import type { CustomProviderFrom } from '@metorial-subspace/db';
import { containsTokenForReview } from '@metorial-subspace/module-protoguard';
import type { LedgerFact } from '@metorial/review-engine';

let REDACTED_QUERY_VALUE = '[REDACTED]';
let OAUTH_URL_FIELDS = [
  'issuer',
  'authorization_endpoint',
  'token_endpoint',
  'userinfo_endpoint',
  'registration_endpoint',
  'resource'
] as const;
let OAUTH_STRING_LIST_FIELDS = [
  'scopes',
  'scopes_supported',
  'response_types_supported',
  'token_endpoint_auth_methods_supported',
  'grant_types_supported',
  'code_challenge_methods_supported',
  'bearer_methods_supported'
] as const;

let stringList = v.array(v.string());

let booleanValue = v.boolean();

export let normalizeReviewUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;

  let query = [...url.searchParams];
  if (query.some(([, parameter]) => containsTokenForReview(parameter))) {
    url.search = '';
    for (let [key, parameter] of query) {
      url.searchParams.append(
        key,
        containsTokenForReview(parameter) ? REDACTED_QUERY_VALUE : parameter
      );
    }
  }

  return { url: url.href, host: url.hostname, httpsEnabled: url.protocol == 'https:' };
};

export let buildRemoteEvidence = (from: Extract<CustomProviderFrom, { type: 'remote' }>) => {
  let warnings: string[] = [];
  let projectUrl = (value: string, field: string) => {
    let normalized = normalizeReviewUrl(value);
    if (!normalized) warnings.push(`${field} is invalid or contains URL credentials.`);
    else if (!normalized.httpsEnabled)
      warnings.push(`${field} does not use HTTPS; transport is not encrypted.`);

    return normalized;
  };

  let remote = projectUrl(from.remoteUrl, 'url');
  let config = from.oauthConfig;
  let oauth: Record<string, unknown> | null = config ? { configured: true } : null;

  if (config && oauth) {
    for (let field of OAUTH_URL_FIELDS) {
      if (typeof config[field] != 'string') continue;

      let normalized = projectUrl(config[field], `oauth.${field}`);
      if (normalized) oauth[field] = normalized.url;
    }

    let servers = stringList.validate(config.authorization_servers);
    if (servers.success) {
      oauth.authorization_servers = servers.value.flatMap((server, index) => {
        let normalized = projectUrl(server, `oauth.authorization_servers[${index}]`);
        return normalized ? [normalized.url] : [];
      });
    }

    for (let field of OAUTH_STRING_LIST_FIELDS) {
      let result = stringList.validate(config[field]);
      if (result.success) oauth[field] = result.value;
    }

    let pkce = booleanValue.validate(config.pkce_required);
    if (pkce.success) oauth.pkce_required = pkce.value;
  }

  return {
    files: {
      'remote.json': JSON.stringify(
        {
          url: remote?.url ?? null,
          host: remote?.host ?? null,
          protocol: from.protocol,
          httpsEnabled: remote?.httpsEnabled ?? null,
          oauth,
          warnings
        },
        null,
        2
      )
    },
    facts: [
      {
        id: 'remote-host',
        title: remote ? `Hosted at ${remote.host}` : 'Remote endpoint URL is invalid',
        detail: [
          remote
            ? `The server is reached at ${remote.url} over ${from.protocol}.`
            : 'The remote endpoint URL could not be included in the review.',
          ...warnings
        ].join('\n')
      }
    ] satisfies LedgerFact[]
  };
};
