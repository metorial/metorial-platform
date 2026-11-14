import { assertScmBackendAllowed } from './scmPolicy';
import { Gitlab } from '@gitbeaker/rest';
import { badRequestError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import type { ScmBackend, ScmInstallation } from '../../prisma/generated/client';
import { db } from '../db';
import {
  hasInstallationTokens,
  readBackendSecret,
  readInstallationTokens,
  writeRefreshedInstallationTokens
} from './scmCredentials';
import { withScmProviderError, wrapScmProviderError } from './scmProviderError';
import { usingScmTokenRefreshLock } from './scmTokenRefreshLock';

type GitLabInstallation = ScmInstallation & { backend: ScmBackend };

let tokenRefreshes = new Map<bigint, Promise<string>>();

export let createGitLabClient = (backend?: ScmBackend) => {
  assertScmBackendAllowed(backend);

  let host = backend?.webUrl ?? 'https://gitlab.com';
  let oauthToken = undefined; // Will be set when we have a token

  return new Gitlab({
    host,
    oauthToken
  });
};

export let createGitLabClientWithToken = (token: string, backend?: ScmBackend) => {
  assertScmBackendAllowed(backend);

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
  assertScmBackendAllowed(i.backend);

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
  assertScmBackendAllowed(i.backend);

  let webUrl = i.backend.webUrl;
  let clientId = i.backend.clientId;
  let clientSecret = await readBackendSecret(i.backend, 'clientSecret', 'origin:gitlab:oauth');

  let response = await withScmProviderError('gitlab', 'exchange the OAuth token', () =>
    fetch(`${webUrl}/oauth/token`, {
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
    })
  );

  if (!response.ok) {
    throw wrapScmProviderError(
      'gitlab',
      { response: { status: response.status } },
      'exchange the OAuth token'
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
  assertScmBackendAllowed(i.backend);

  let webUrl = i.backend.webUrl;
  let clientId = i.backend.clientId;
  let clientSecret = await readBackendSecret(i.backend, 'clientSecret', 'origin:gitlab:oauth');

  let response = await withScmProviderError('gitlab', 'refresh the OAuth token', () =>
    fetch(`${webUrl}/oauth/token`, {
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
    })
  );

  if (!response.ok) {
    throw wrapScmProviderError(
      'gitlab',
      { response: { status: response.status } },
      'refresh the OAuth token'
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

export let createGitLabClientWithInstallation = async (installation: GitLabInstallation) => {
  let accessToken = await getGitLabAccessTokenWithInstallation(installation);
  return createGitLabClientWithToken(accessToken, installation.backend);
};

let tokenNeedsRefresh = (expiresAt: Date | null) => {
  let refreshBuffer = new Date(Date.now() + 5 * 60 * 1000);
  return !expiresAt || expiresAt < refreshBuffer;
};

let refreshGitLabInstallationCredentials = async (
  installation: GitLabInstallation
): Promise<string> =>
  usingScmTokenRefreshLock('gitlab', installation.oid, async () => {
    let persisted = await db.scmInstallation.findUnique({
      where: { oid: installation.oid }
    });
    let current = persisted ? { ...installation, ...persisted } : installation;
    let tokens = await readInstallationTokens(current, 'origin:gitlab:refresh');

    if (tokens.accessToken && !tokenNeedsRefresh(current.accessTokenExpiresAt)) {
      return tokens.accessToken;
    }
    if (!tokens.refreshToken) {
      throw new ServiceError(
        unauthorizedError({
          message: 'GitLab authentication expired. Reconnect the GitLab integration.'
        })
      );
    }

    try {
      let refreshed = await refreshGitLabAccessToken({
        backend: current.backend,
        refreshToken: tokens.refreshToken
      });

      await writeRefreshedInstallationTokens(current, refreshed);

      return refreshed.accessToken;
    } catch (error) {
      let winner = await db.scmInstallation.findUnique({
        where: { oid: current.oid }
      });
      let winnerTokens = winner
        ? await readInstallationTokens(winner, 'origin:gitlab:refresh-winner').catch(
            () => null
          )
        : null;

      if (
        winner &&
        winnerTokens?.accessToken &&
        !tokenNeedsRefresh(winner.accessTokenExpiresAt) &&
        (winnerTokens.accessToken !== tokens.accessToken ||
          winnerTokens.refreshToken !== tokens.refreshToken)
      ) {
        return winnerTokens.accessToken;
      }

      throw error;
    }
  });

export let getGitLabAccessTokenWithInstallation = async (
  installation: GitLabInstallation
): Promise<string> => {
  assertScmBackendAllowed(installation.backend);

  if (!hasInstallationTokens(installation)) {
    throw new ServiceError(badRequestError({ message: 'Access token not found' }));
  }

  if (!tokenNeedsRefresh(installation.accessTokenExpiresAt)) {
    let tokens = await readInstallationTokens(installation, 'origin:gitlab:api');
    if (!tokens.accessToken) {
      throw new ServiceError(badRequestError({ message: 'Access token not found' }));
    }

    return tokens.accessToken;
  }

  let refresh = tokenRefreshes.get(installation.oid);
  if (!refresh) {
    refresh = refreshGitLabInstallationCredentials(installation);
    tokenRefreshes.set(installation.oid, refresh);
    let clearRefresh = () => {
      if (tokenRefreshes.get(installation.oid) === refresh) {
        tokenRefreshes.delete(installation.oid);
      }
    };
    void refresh.then(clearRefresh, clearRefresh);
  }

  return await refresh;
};
