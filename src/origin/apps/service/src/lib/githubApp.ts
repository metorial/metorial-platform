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
