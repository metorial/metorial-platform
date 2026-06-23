import { Gitlab } from '@gitbeaker/rest';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { ScmBackend, ScmInstallation } from '../../prisma/generated/client';
import { db } from '../db';

export let createGitLabClient = (backend?: ScmBackend) => {
  let host = backend?.webUrl ?? 'https://gitlab.com';
  let oauthToken = undefined; // Will be set when we have a token

  return new Gitlab({
    host,
    oauthToken
  });
};

export let createGitLabClientWithToken = (token: string, backend?: ScmBackend) => {
  let host = backend?.webUrl ?? 'https://gitlab.com';

  return new Gitlab({
    host,
    oauthToken: token
  });
};

export let getGitLabOAuthUrl = (i: {
  backend: ScmBackend;
  redirectUri: string;
  state: string;
}) => {
  let webUrl = i.backend.webUrl;
  let clientId = i.backend.clientId;

  let url = new URL(`${webUrl}/oauth/authorize`);
  url.searchParams.set('client_id', clientId!);
  url.searchParams.set('redirect_uri', i.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', i.state);
  url.searchParams.set('scope', 'api read_user read_repository write_repository');

  return url.toString();
};

export let exchangeGitLabOAuthCode = async (i: {
  backend: ScmBackend;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> => {
  let webUrl = i.backend.webUrl;
  let clientId = i.backend.clientId;
  let clientSecret = i.backend.clientSecret;

  let response = await fetch(`${webUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: i.code,
      grant_type: 'authorization_code',
      redirect_uri: i.redirectUri
    })
  });

  if (!response.ok) {
    throw new ServiceError(
      badRequestError({
        message: `GitLab OAuth token exchange failed: ${response.statusText}`
      })
    );
  }

  let data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };

  let expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt
  };
};

export let refreshGitLabAccessToken = async (i: {
  backend: ScmBackend;
  refreshToken: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> => {
  let webUrl = i.backend.webUrl;
  let clientId = i.backend.clientId;
  let clientSecret = i.backend.clientSecret;

  let response = await fetch(`${webUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: i.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new ServiceError(
      badRequestError({
        message: `GitLab token refresh failed: ${response.statusText}`
      })
    );
  }

  let data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };

  let expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt
  };
};

export let createGitLabClientWithInstallation = async (
  installation: ScmInstallation & { backend: ScmBackend }
) => {
  if (!installation.accessToken) {
    throw new ServiceError(badRequestError({ message: 'Access token not found' }));
  }

  // Check if token is expired or will expire in the next 5 minutes
  let now = new Date();
  let bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
  let needsRefresh = !installation.accessTokenExpiresAt || installation.accessTokenExpiresAt < bufferTime;

  if (needsRefresh && installation.refreshToken) {
    // Refresh the token
    let refreshed = await refreshGitLabAccessToken({
      backend: installation.backend,
      refreshToken: installation.refreshToken
    });

    // Update the installation in the database
    await db.scmInstallation.update({
      where: { oid: installation.oid },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        accessTokenExpiresAt: refreshed.expiresAt
      }
    });

    // Use the new token
    return createGitLabClientWithToken(refreshed.accessToken, installation.backend);
  }

  // Token is still valid, use it
  return createGitLabClientWithToken(installation.accessToken, installation.backend);
};
