import { ServiceError, badRequestError, unauthorizedError } from '@mtsrc/error';
import { Context } from 'hono';

export let getString = (value: unknown) => {
  if (typeof value == 'string' && value.trim().length > 0) return value;
  return undefined;
};

export let parseOAuthBody = async (c: Context): Promise<Record<string, string>> => {
  try {
    let contentType = c.req.header('content-type');

    if (contentType?.startsWith('application/x-www-form-urlencoded')) {
      return (await c.req.parseBody()) as Record<string, string>;
    }

    if (contentType?.startsWith('application/json')) {
      return await c.req.json();
    }

    return {};
  } catch {
    throw new ServiceError(
      badRequestError({
        message: 'Failed to parse request body',
        oauth: {
          error: 'invalid_request',
          errorMessage: 'Failed to parse request body'
        }
      })
    );
  }
};

export let getClientCredentialsFromBasicAuth = (c: Context) => {
  let authorization = c.req.header('authorization');
  if (!authorization?.startsWith('Basic ')) return null;

  try {
    let decoded = Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8');
    let separator = decoded.indexOf(':');
    if (separator < 0) {
      throw new Error('invalid basic auth');
    }

    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1)
    };
  } catch {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid basic authorization header',
        oauth: {
          error: 'invalid_client',
          errorMessage: 'Invalid basic authorization header'
        }
      })
    );
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
    throw new ServiceError(
      unauthorizedError({
        message: 'Conflicting oauth client credentials provided',
        oauth: {
          error: 'invalid_client',
          errorMessage: 'Conflicting oauth client credentials provided'
        }
      })
    );
  }

  return {
    clientId: fromBasic?.clientId ?? bodyClientId,
    clientSecret: fromBasic?.clientSecret ?? bodyClientSecret
  };
};
