import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Actor, ScmProvider, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import { createGitHubAppClient } from '../lib/githubApp';
import {
  createGitLabClientWithToken,
  exchangeGitLabOAuthCode,
  getGitLabOAuthUrl
} from '../lib/gitlab';

class scmAuthServiceImpl {
  async getAuthorizationUrl(i: {
    tenant: Tenant;
    actor: Actor;
    provider: 'github' | 'gitlab';
    backendId: string;
    redirectUrl: string;
    state: string; // State from installation session
  }) {
    let backend = await db.scmBackend.findFirst({
      where: {
        id: i.backendId,
        OR: [{ tenantOid: i.tenant.oid }, { tenantOid: null }]
      }
    });

    if (!backend) {
      throw new ServiceError(notFoundError('scm_backend'));
    }

    if (
      i.provider === 'github' &&
      (backend.type === 'github' || backend.type === 'github_enterprise')
    ) {
      // GitHub Apps use installation authorization flow
      let webUrl = backend.webUrl;
      let appSlug = backend.appSlug;

      if (!appSlug) {
        throw new ServiceError(
          badRequestError({
            message: 'GitHub backend missing appSlug'
          })
        );
      }

      let url = new URL(`${webUrl}/apps/${appSlug}/installations/new`);
      url.searchParams.set('state', i.state);
      return url.toString();
    }

    if (
      i.provider === 'gitlab' &&
      (backend.type === 'gitlab' || backend.type === 'gitlab_selfhosted')
    ) {
      // GitLab OAuth authorization flow
      return getGitLabOAuthUrl({
        backend,
        redirectUri: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/oauth/gitlab/callback`,
        state: i.state
      });
    }

    throw new ServiceError(
      badRequestError({
        message: 'Unsupported provider'
      })
    );
  }

  async handleInstallation(i: {
    provider: 'github';
    installationId: string;
    setupAction: string;
    state: string;
  }) {
    let session = await db.scmInstallationSession.findUnique({
      where: {
        state: i.state
      },
      include: {
        tenant: true,
        ownerActor: true
      }
    });
    if (!session) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid state'
        })
      );
    }

    // We need to find the backend that was selected
    // For GitHub, find the backend used in the OAuth flow
    let backend = await db.scmBackend.findFirst({
      where: {
        OR: [
          { isDefault: true, tenantOid: null, type: { in: ['github', 'github_enterprise'] } },
          { tenantOid: session.tenantOid, type: { in: ['github', 'github_enterprise'] } }
        ]
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });

    if (!backend) {
      throw new ServiceError(notFoundError('scm_backend.github'));
    }

    if (i.provider === 'github') {
      // Get installation details using GitHub App authentication
      let octokit = createGitHubAppClient(backend);

      let installationRes = await octokit.request('GET /app/installations/{installation_id}', {
        installation_id: parseInt(i.installationId)
      });

      let installation = installationRes.data;
      let account = installation.account;

      if (!account) {
        throw new ServiceError(badRequestError({ message: 'Installation account not found' }));
      }

      // Handle both User and Organization types
      let accountType: 'user' | 'organization' =
        'type' in account && account.type === 'User' ? 'user' : 'organization';
      let accountLogin =
        'login' in account ? account.login : 'slug' in account ? account.slug : '';
      let accountName = account.name || accountLogin;
      let accountEmail = 'email' in account ? account.email : null;

      let data = {
        provider: i.provider,
        tenantOid: session.tenantOid,
        backendOid: backend.oid,
        ownerActorOid: session.ownerActorOid,

        externalInstallationId: i.installationId,
        accountType: accountType as 'user' | 'organization',

        externalAccountId: account.id.toString(),
        externalAccountLogin: accountLogin,
        externalAccountName: accountName || null,
        externalAccountEmail: accountEmail || null,
        externalAccountImageUrl: account.avatar_url || null
      };

      let createdInstallation = await db.scmInstallation.upsert({
        where: {
          tenantOid_provider_backendOid_externalAccountId: {
            tenantOid: session.tenantOid,
            provider: i.provider,
            backendOid: backend.oid,
            externalAccountId: account.id.toString()
          }
        },
        update: data,
        create: {
          ...getId('scmInstallation'),
          ...data
        }
      });

      // Complete the installation session
      await db.scmInstallationSession.update({
        where: { id: session.id },
        data: { installationOid: createdInstallation.oid }
      });

      return createdInstallation;
    }

    throw new ServiceError(
      badRequestError({
        message: 'Unsupported provider'
      })
    );
  }

  async handleGitLabOAuthCallback(i: { provider: 'gitlab'; code: string; state: string }) {
    let session = await db.scmInstallationSession.findUnique({
      where: {
        state: i.state
      },
      include: {
        tenant: true,
        ownerActor: true
      }
    });
    if (!session) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid state'
        })
      );
    }

    // Find the GitLab backend
    let backend = await db.scmBackend.findFirst({
      where: {
        OR: [
          { isDefault: true, tenantOid: null, type: { in: ['gitlab', 'gitlab_selfhosted'] } },
          { tenantOid: session.tenantOid, type: { in: ['gitlab', 'gitlab_selfhosted'] } }
        ]
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });

    if (!backend) {
      throw new ServiceError(notFoundError('scm_backend.gitlab'));
    }

    if (i.provider === 'gitlab') {
      // Exchange code for tokens
      let { accessToken, refreshToken, expiresAt } = await exchangeGitLabOAuthCode({
        backend,
        code: i.code,
        redirectUri: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/oauth/gitlab/callback`
      });

      // Get user info
      let gitlab = createGitLabClientWithToken(accessToken, backend);
      let user = await gitlab.Users.showCurrentUser();

      let data = {
        provider: i.provider,
        tenantOid: session.tenantOid,
        backendOid: backend.oid,
        ownerActorOid: session.ownerActorOid,

        accessToken,
        refreshToken,
        accessTokenExpiresAt: expiresAt,
        accountType: 'user' as const,

        externalAccountId: user.id.toString(),
        externalAccountLogin: user.username,
        externalAccountName: user.name || user.username,
        externalAccountEmail: user.email || null,
        externalAccountImageUrl: user.avatar_url || null
      };

      let createdInstallation = await db.scmInstallation.upsert({
        where: {
          tenantOid_provider_backendOid_externalAccountId: {
            tenantOid: session.tenantOid,
            provider: i.provider,
            backendOid: backend.oid,
            externalAccountId: user.id.toString()
          }
        },
        update: data,
        create: {
          ...getId('scmInstallation'),
          ...data
        }
      });

      // Complete the installation session
      await db.scmInstallationSession.update({
        where: { id: session.id },
        data: { installationOid: createdInstallation.oid }
      });

      return createdInstallation;
    }

    throw new ServiceError(
      badRequestError({
        message: 'Unsupported provider'
      })
    );
  }

  async getMatchingInstallation(i: {
    tenant: Tenant;
    ownerActor: Actor;
    provider: ScmProvider;
  }) {
    let installation = await db.scmInstallation.findFirst({
      where: {
        tenantOid: i.tenant.oid,
        provider: i.provider,
        ownerActorOid: i.ownerActor.oid
      }
    });
    if (installation) return installation;

    installation = await db.scmInstallation.findFirst({
      where: {
        tenantOid: i.tenant.oid,
        provider: i.provider
      }
    });
    if (installation) return installation;

    throw new ServiceError(notFoundError('integrations.scm.installation'));
  }
}

export let scmAuthService = Service.create(
  'scmAuthService',
  () => new scmAuthServiceImpl()
).build();
