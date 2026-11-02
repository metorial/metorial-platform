import { checkEdition } from '@metorial/editions';
import { assertScmBackendAllowed } from './scmPolicy';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/core';
import type { ScmBackend } from '../../prisma/generated/client';
import { env, SCM_GITHUB_APP_PRIVATE_KEY } from '../env';
import { readBackendSecret } from './scmCredentials';

let GITHUB_REST_API_VERSION = '2022-11-28';

let getAppPrivateKey = async (backend?: ScmBackend) => {
  let backendKey = backend
    ? await readBackendSecret(backend, 'appPrivateKey', 'origin:github:app')
    : null;

  return (
    backendKey ?? (checkEdition('cloud') ? SCM_GITHUB_APP_PRIVATE_KEY : undefined)
  )?.replace(/\\n/g, '\n');
};

export let createGitHubAppClient = async (backend?: ScmBackend) => {
  assertScmBackendAllowed(backend);

  let appId = backend?.appId ?? (checkEdition('cloud') ? env.gh.SCM_GITHUB_APP_ID : undefined);
  let privateKey = await getAppPrivateKey(backend);
  let baseUrl = backend?.apiUrl ?? 'https://api.github.com';

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey
    },
    baseUrl,
    request: {
      headers: {
        'X-GitHub-Api-Version': GITHUB_REST_API_VERSION
      }
    }
  });
};

export let exchangeGitHubOAuthCode = async (i: {
  backend: ScmBackend;
  code: string;
  redirectUri: string;
}) => {
  assertScmBackendAllowed(i.backend);

  let clientSecret = await readBackendSecret(i.backend, 'clientSecret', 'origin:github:oauth');

  if (!i.backend.clientId || !clientSecret) {
    throw new Error('GitHub backend is missing OAuth credentials');
  }

  let response = await fetch(
    checkEdition('on-prem')
      ? `${i.backend.webUrl.replace(/\/$/, '')}/login/oauth/access_token`
      : new URL('/login/oauth/access_token', i.backend.webUrl),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Metorial Origin'
      },
      body: new URLSearchParams({
        client_id: i.backend.clientId,
        client_secret: clientSecret,
        code: i.code,
        redirect_uri: i.redirectUri
      })
    }
  );
  let body = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || 'GitHub OAuth exchange failed');
  }
  return body.access_token;
};

export let getGitHubAuthenticatedUser = async (backend: ScmBackend, accessToken: string) => {
  assertScmBackendAllowed(backend);

  let github = new Octokit({
    auth: accessToken,
    baseUrl: backend.apiUrl,
    request: { headers: { 'X-GitHub-Api-Version': GITHUB_REST_API_VERSION } }
  });
  return (await github.request('GET /user')).data;
};

export let listGitHubInstallationRequests = async (backend: ScmBackend) => {
  let github = await createGitHubAppClient(backend);
  let requests: any[] = [];
  for (let page = 1; ; page++) {
    let response = await github.request('GET /app/installation-requests', {
      per_page: 100,
      page
    });
    requests.push(...response.data);
    if (response.data.length < 100) break;
  }
  return requests;
};

export let getGitHubInstallationForAccount = async (i: {
  backend: ScmBackend;
  accountLogin: string;
  accountType: 'user' | 'organization';
}) => {
  let github = await createGitHubAppClient(i.backend);
  try {
    if (i.accountType === 'user') {
      return (
        await github.request('GET /users/{username}/installation', {
          username: i.accountLogin
        })
      ).data;
    }
    return (
      await github.request('GET /orgs/{org}/installation', {
        org: i.accountLogin
      })
    ).data;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 404
    ) {
      return null;
    }
    throw error;
  }
};

export let createGitHubInstallationClient = async (
  installationId: string,
  backend?: ScmBackend
) => {
  assertScmBackendAllowed(backend);

  let appId = backend?.appId ?? (checkEdition('cloud') ? env.gh.SCM_GITHUB_APP_ID : undefined);
  let privateKey = await getAppPrivateKey(backend);
  let baseUrl = backend?.apiUrl ?? 'https://api.github.com';

  let octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId: parseInt(installationId)
    },
    baseUrl,
    request: {
      headers: {
        'X-GitHub-Api-Version': GITHUB_REST_API_VERSION
      }
    }
  });

  return octokit;
};

export let getInstallationAccessToken = async (
  installationId: string,
  backend?: ScmBackend
): Promise<string> => {
  let octokit = await createGitHubAppClient(backend);

  let response = await octokit.request(
    'POST /app/installations/{installation_id}/access_tokens',
    {
      installation_id: parseInt(installationId)
    }
  );

  return response.data.token;
};

export let getGitHubTransferEndpoints = (backend: ScmBackend, owner: string, repo: string) => {
  if (checkEdition('cloud')) return {};
  assertScmBackendAllowed(backend);

  return {
    githubApiUrl: backend.apiUrl,
    githubLfsEndpoint: `${backend.webUrl.replace(/\/$/, '')}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git/info/lfs`
  };
};
