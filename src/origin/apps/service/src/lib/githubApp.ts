import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/core';
import type { ScmBackend } from '../../prisma/generated/client';
import { env, SCM_GITHUB_APP_PRIVATE_KEY } from '../env';

let GITHUB_REST_API_VERSION = '2022-11-28';

export let createGitHubAppClient = (backend?: ScmBackend) => {
  let appId = backend?.appId ?? env.gh.SCM_GITHUB_APP_ID;
  let privateKey = (backend?.appPrivateKey ?? SCM_GITHUB_APP_PRIVATE_KEY)?.replace(
    /\\n/g,
    '\n'
  );
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
  if (!i.backend.clientId || !i.backend.clientSecret) {
    throw new Error('GitHub backend is missing OAuth credentials');
  }

  let response = await fetch(new URL('/login/oauth/access_token', i.backend.webUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Metorial Origin'
    },
    body: new URLSearchParams({
      client_id: i.backend.clientId,
      client_secret: i.backend.clientSecret,
      code: i.code,
      redirect_uri: i.redirectUri
    })
  });
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
  let github = new Octokit({
    auth: accessToken,
    baseUrl: backend.apiUrl,
    request: { headers: { 'X-GitHub-Api-Version': GITHUB_REST_API_VERSION } }
  });
  return (await github.request('GET /user')).data;
};

export let listGitHubInstallationRequests = async (backend: ScmBackend) => {
  let github = createGitHubAppClient(backend);
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
  let github = createGitHubAppClient(i.backend);
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
  let appId = backend?.appId ?? env.gh.SCM_GITHUB_APP_ID;
  let privateKey = (backend?.appPrivateKey ?? SCM_GITHUB_APP_PRIVATE_KEY)?.replace(
    /\\n/g,
    '\n'
  );
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
  let octokit = createGitHubAppClient(backend);

  let response = await octokit.request(
    'POST /app/installations/{installation_id}/access_tokens',
    {
      installation_id: parseInt(installationId)
    }
  );

  return response.data.token;
};
