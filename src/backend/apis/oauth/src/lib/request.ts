import { isServiceError } from '@lowerdeck/error';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { Context } from 'hono';
import { OAuthError } from './errors';

export let getString = (value: unknown): string | undefined => {
  if (typeof value == 'string' && value.trim().length > 0) return value;
  return undefined;
};

export let normalizeScopes = (value: unknown): string[] | undefined => {
  if (typeof value != 'string') return undefined;

  let scopes = value
    .split(/\s+/)
    .map(scope => scope.trim())
    .filter(Boolean);

  if (scopes.length == 0) return undefined;

  return [...new Set(scopes)];
};

export let parseOAuthBody = async (c: Context): Promise<Record<string, string>> => {
  try {
    let contentType = c.req.header('content-type');

    if (contentType?.startsWith('application/x-www-form-urlencoded')) {
      return await c.req.parseBody();
    }

    if (contentType?.startsWith('application/json')) {
      return await c.req.parseBody();
    }

    return {};
  } catch (e) {
    if (isServiceError(e)) throw e;

    throw new OAuthError({
      error: 'invalid_request',
      errorMessage: 'Failed to parse request body'
    });
  }
};

export let getClientCredentialsFromBasicAuth = (c: Context) => {
  let authorization = c.req.header('authorization');
  if (!authorization?.startsWith('Basic ')) return null;

  try {
    let decoded = Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8');
    let separator = decoded.indexOf(':');

    if (separator < 0) {
      throw new OAuthError({
        error: 'invalid_client',
        status: 401,
        errorMessage: 'Invalid basic authorization header'
      });
    }

    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1)
    };
  } catch (e) {
    if (isServiceError(e)) throw e;

    throw new OAuthError({
      error: 'invalid_client',
      status: 401,
      errorMessage: 'Invalid basic authorization header'
    });
  }
};

export let getClientCredentials = (c: Context, body: Record<string, string>) => {
  let fromBasic = getClientCredentialsFromBasicAuth(c);

  let bodyClientId = getString(body.client_id);
  let bodyClientSecret = getString(body.client_secret);

  if (
    (fromBasic?.clientId && bodyClientId && fromBasic.clientId != bodyClientId) ||
    (fromBasic?.clientSecret && bodyClientSecret && fromBasic.clientSecret != bodyClientSecret)
  ) {
    throw new OAuthError({
      error: 'invalid_client',
      status: 401,
      errorMessage: 'Conflicting oauth client credentials provided'
    });
  }

  return {
    clientId: fromBasic?.clientId ?? bodyClientId,
    clientSecret: fromBasic?.clientSecret ?? bodyClientSecret
  };
};

export let ensureOptionalClientSecretIsValid = async (d: {
  clientId: string;
  clientSecret?: string;
}) => {
  if (!d.clientSecret) return;

  await oauthAuthorizationService.getOAuthApplicationByClientId({
    clientId: d.clientId,
    clientSecret: d.clientSecret
  });
};
