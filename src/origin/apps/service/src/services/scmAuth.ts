import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Actor, ScmBackend, ScmProvider, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import {
  createBitbucketClientWithToken,
  exchangeBitbucketOAuthCode,
  getBitbucketOAuthUrl
} from '../lib/bitbucket';
import {
  createGitHubAppClient,
  exchangeGitHubOAuthCode,
  getGitHubAuthenticatedUser,
  getGitHubInstallationForAccount,
  listGitHubInstallationRequests
} from '../lib/githubApp';
import {
  createGitLabClientWithToken,
  exchangeGitLabOAuthCode,
  getGitLabOAuthUrl
} from '../lib/gitlab';
import { withScmProviderError } from '../lib/scmProviderError';
import { scmInstallationSessionService } from './scmInstallationSession';

class scmAuthServiceImpl {
  async getAuthorizationUrl(i: {
    tenant: Tenant;
    actor: Actor;
    provider: 'github' | 'gitlab' | 'bitbucket';
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

    if (
      i.provider === 'bitbucket' &&
      (backend.type === 'bitbucket' || backend.type === 'bitbucket_data_center')
    ) {
      return getBitbucketOAuthUrl({
        backend,
        redirectUri: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/oauth/bitbucket/callback`,
        state: i.state
      });
    }

    throw new ServiceError(
      badRequestError({
        message: 'Unsupported provider'
      })
    );
  }

  async prepareGitHubInstallationRequest(i: { sessionId: string; backend: ScmBackend }) {
    try {
      let requests = await listGitHubInstallationRequests(i.backend);
      await scmInstallationSessionService.setGitHubInstallationRequestBaseline({
        sessionId: i.sessionId,
        requestIds: requests.map(request => String(request.id))
      });
    } catch (error) {
      console.warn('Could not snapshot GitHub installation requests', error);
    }
  }

  private githubAccount(installation: any) {
    let account = installation.account;
    if (!account) {
      throw new ServiceError(badRequestError({ message: 'Installation account not found' }));
    }
    let login = 'login' in account ? account.login : 'slug' in account ? account.slug : '';
    return {
      id: String(account.id),
      login,
      type: account.type === 'User' ? ('user' as const) : ('organization' as const),
      name: account.name || login || null,
      email: 'email' in account ? account.email || null : null,
      imageUrl: account.avatar_url || null
    };
  }

  private async loadGitHubInstallation(backend: ScmBackend, installationId: string) {
    let github = createGitHubAppClient(backend);
    return (
      await withScmProviderError('github', 'load the app installation', () =>
        github.request('GET /app/installations/{installation_id}', {
          installation_id: parseInt(installationId)
        })
      )
    ).data;
  }

  private async materializeGitHubInstallationForSession(i: {
    session: { id: string; tenantOid: bigint; ownerActorOid: bigint };
    backend: ScmBackend;
    installation: any;
  }) {
    let account = this.githubAccount(i.installation);
    let data = {
      provider: 'github' as const,
      tenantOid: i.session.tenantOid,
      backendOid: i.backend.oid,
      ownerActorOid: i.session.ownerActorOid,
      externalInstallationId: String(i.installation.id),
      accountType: account.type,
      externalAccountId: account.id,
      externalAccountLogin: account.login,
      externalAccountName: account.name,
      externalAccountEmail: account.email,
      externalAccountImageUrl: account.imageUrl
    };
    let record = await db.scmInstallation.upsert({
      where: {
        tenantOid_provider_backendOid_externalAccountId: {
          tenantOid: i.session.tenantOid,
          provider: 'github',
          backendOid: i.backend.oid,
          externalAccountId: account.id
        }
      },
      update: data,
      create: { ...getId('scmInstallation'), ...data }
    });
    await scmInstallationSessionService.completeInstallationSession({
      sessionId: i.session.id,
      installationOid: record.oid
    });
    return record;
  }

  private async completePendingGitHubSessions(backend: ScmBackend, installation: any) {
    let account = this.githubAccount(installation);
    let sessions = await db.scmInstallationSession.findMany({
      where: {
        status: 'pending_approval',
        selectedBackendOid: backend.oid,
        githubPendingAccountId: account.id,
        expiresAt: { gt: new Date() }
      }
    });
    for (let session of sessions) {
      await this.materializeGitHubInstallationForSession({ session, backend, installation });
    }
    return sessions.length;
  }

  private async refreshExistingGitHubInstallations(backend: ScmBackend, installation: any) {
    let account = this.githubAccount(installation);
    let result = await db.scmInstallation.updateMany({
      where: {
        provider: 'github',
        backendOid: backend.oid,
        externalInstallationId: String(installation.id)
      },
      data: {
        accountType: account.type,
        externalAccountId: account.id,
        externalAccountLogin: account.login,
        externalAccountName: account.name,
        externalAccountEmail: account.email,
        externalAccountImageUrl: account.imageUrl
      }
    });
    return result.count;
  }

  private async handleGitHubApprovalRequest(i: { state: string; code?: string }) {
    let session = await db.scmInstallationSession.findUnique({
      where: { state: i.state },
      include: { selectedBackend: true }
    });
    if (!session || session.expiresAt <= new Date() || !session.selectedBackend) {
      throw new ServiceError(badRequestError({ message: 'Invalid state' }));
    }
    if (session.status === 'succeeded' || session.status === 'pending_approval')
      return session;
    let backend = session.selectedBackend;
    if (backend.type !== 'github' && backend.type !== 'github_enterprise') {
      throw new ServiceError(notFoundError('scm_backend.github'));
    }

    let requesterId: string | undefined;
    if (i.code) {
      try {
        let accessToken = await exchangeGitHubOAuthCode({
          backend,
          code: i.code,
          redirectUri: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/oauth/github/callback`
        });
        requesterId = String((await getGitHubAuthenticatedUser(backend, accessToken)).id);
      } catch (error) {
        console.warn('Could not identify GitHub installation requester', error);
      }
    }

    let request: any | undefined;
    try {
      let baseline = new Set(session.githubInstallationRequestBaselineIds);
      let requests = await listGitHubInstallationRequests(backend);
      let candidates = requests.filter(candidate => {
        if (baseline.has(String(candidate.id))) return false;
        if (requesterId && String(candidate.requester?.id) !== requesterId) return false;
        return (
          new Date(candidate.created_at).getTime() >= session.createdAt.getTime() - 60_000
        );
      });
      if (candidates.length === 0 && requesterId) {
        candidates = requests.filter(
          candidate => String(candidate.requester?.id) === requesterId
        );
      }
      request = candidates.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    } catch (error) {
      console.warn('Could not correlate GitHub installation request', error);
    }

    let account = request?.account;
    return await scmInstallationSessionService.markPendingApproval({
      sessionId: session.id,
      requestId: request ? String(request.id) : undefined,
      requesterId,
      accountId: account?.id != null ? String(account.id) : undefined,
      accountLogin: account?.login,
      accountType: account?.type === 'User' ? 'user' : account ? 'organization' : undefined
    });
  }

  async handleInstallation(i: {
    provider: 'github';
    installationId?: string;
    setupAction: string;
    state?: string;
    code?: string;
  }) {
    if (i.setupAction === 'request') {
      if (!i.state) {
        throw new ServiceError(badRequestError({ message: 'Missing state' }));
      }
      let session = await this.handleGitHubApprovalRequest({ state: i.state, code: i.code });
      return {
        kind:
          session.status === 'succeeded'
            ? ('succeeded' as const)
            : ('pending_approval' as const),
        sessionId: session.id,
        matched: true
      };
    }
    if (
      !i.installationId ||
      !/^\d+$/.test(i.installationId) ||
      !['install', 'update'].includes(i.setupAction)
    ) {
      throw new ServiceError(badRequestError({ message: 'Invalid GitHub callback' }));
    }

    if (i.state) {
      let session = await db.scmInstallationSession.findUnique({
        where: { state: i.state },
        include: { selectedBackend: true }
      });
      if (!session || session.expiresAt <= new Date() || !session.selectedBackend) {
        throw new ServiceError(badRequestError({ message: 'Invalid state' }));
      }
      let backend = session.selectedBackend;
      if (backend.type !== 'github' && backend.type !== 'github_enterprise') {
        throw new ServiceError(notFoundError('scm_backend.github'));
      }
      let installation = await this.loadGitHubInstallation(backend, i.installationId);
      await this.materializeGitHubInstallationForSession({ session, backend, installation });
      await this.completePendingGitHubSessions(backend, installation);
      return { kind: 'succeeded' as const, sessionId: session.id, matched: true };
    }

    let existing = await db.scmInstallation.findMany({
      where: { provider: 'github', externalInstallationId: i.installationId },
      include: { backend: true }
    });
    let pending = await db.scmInstallationSession.findMany({
      where: { status: 'pending_approval', expiresAt: { gt: new Date() } },
      include: { selectedBackend: true }
    });
    let defaultBackend = await db.scmBackend.findFirst({
      where: { type: 'github', isDefault: true, tenantOid: null }
    });
    let backends = new Map<string, ScmBackend>();
    for (let record of existing) backends.set(record.backend.id, record.backend);
    for (let session of pending) {
      if (session.selectedBackend)
        backends.set(session.selectedBackend.id, session.selectedBackend);
    }
    if (defaultBackend) backends.set(defaultBackend.id, defaultBackend);

    let matched = false;
    for (let backend of backends.values()) {
      try {
        let installation = await this.loadGitHubInstallation(backend, i.installationId);
        let updated = await this.refreshExistingGitHubInstallations(backend, installation);
        let completed = await this.completePendingGitHubSessions(backend, installation);
        matched = matched || updated > 0 || completed > 0;
      } catch (error) {
        console.warn(
          `GitHub installation ${i.installationId} did not match ${backend.id}`,
          error
        );
      }
    }
    if (!matched) console.warn(`Unmatched state-less GitHub ${i.setupAction} callback`);
    return { kind: 'succeeded' as const, matched };
  }

  async recheckGitHubInstallationSession(i: { sessionId: string }) {
    let session = await scmInstallationSessionService.getInstallationSessionPublic({
      ...i,
      allowExpired: true
    });
    if (session.status === 'succeeded' || session.expiresAt <= new Date()) return session;
    let backend = session.selectedBackend;
    if (
      session.status !== 'pending_approval' ||
      !backend ||
      !session.githubPendingAccountLogin ||
      !session.githubPendingAccountType
    ) {
      return session;
    }
    let installation = await getGitHubInstallationForAccount({
      backend,
      accountLogin: session.githubPendingAccountLogin,
      accountType: session.githubPendingAccountType
    });
    if (installation) {
      await this.materializeGitHubInstallationForSession({ session, backend, installation });
    }
    return await scmInstallationSessionService.getInstallationSessionPublic({
      ...i,
      allowExpired: true
    });
  }

  async handleGitHubAppInstallationCreated(i: { installationId: string }) {
    let backend = await db.scmBackend.findFirst({
      where: { type: 'github', isDefault: true, tenantOid: null }
    });
    if (!backend) return 0;
    let installation = await this.loadGitHubInstallation(backend, i.installationId);
    await this.refreshExistingGitHubInstallations(backend, installation);
    return await this.completePendingGitHubSessions(backend, installation);
  }

  async handleGitLabOAuthCallback(i: { provider: 'gitlab'; code: string; state: string }) {
    let session = await db.scmInstallationSession.findUnique({
      where: {
        state: i.state
      },
      include: {
        tenant: true,
        ownerActor: true,
        selectedBackend: true
      }
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.installationOid != null ||
      !session.selectedBackend
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid state'
        })
      );
    }

    let backend = session.selectedBackend;
    if (backend.type !== 'gitlab' && backend.type !== 'gitlab_selfhosted') {
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
      let user = await withScmProviderError('gitlab', 'load the authenticated user', () =>
        gitlab.Users.showCurrentUser()
      );

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
        externalAccountImageUrl: user.avatar_url != null ? String(user.avatar_url) : null
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

      await scmInstallationSessionService.completeInstallationSession({
        sessionId: session.id,
        installationOid: createdInstallation.oid
      });

      return createdInstallation;
    }

    throw new ServiceError(
      badRequestError({
        message: 'Unsupported provider'
      })
    );
  }

  async handleBitbucketOAuthCallback(i: {
    provider: 'bitbucket';
    code: string;
    state: string;
  }) {
    let session = await db.scmInstallationSession.findUnique({
      where: { state: i.state },
      include: { selectedBackend: true }
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.installationOid != null ||
      !session.selectedBackend
    ) {
      throw new ServiceError(badRequestError({ message: 'Invalid state' }));
    }

    let backend = session.selectedBackend;
    if (backend.type !== 'bitbucket' && backend.type !== 'bitbucket_data_center') {
      throw new ServiceError(notFoundError('scm_backend.bitbucket'));
    }

    let credentials = await exchangeBitbucketOAuthCode({
      backend,
      code: i.code,
      redirectUri: `${env.service.ORIGIN_SERVICE_PUBLIC_URL}/origin/oauth/bitbucket/callback`
    });
    let client = createBitbucketClientWithToken(credentials.accessToken, backend);
    let user = await withScmProviderError('bitbucket', 'load the authenticated user', () =>
      client.getCurrentUser()
    );
    let data = {
      provider: i.provider,
      tenantOid: session.tenantOid,
      backendOid: backend.oid,
      ownerActorOid: session.ownerActorOid,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      accessTokenExpiresAt: credentials.expiresAt,
      accountType: user.type,
      externalAccountId: user.id,
      externalAccountLogin: user.slug,
      externalAccountName: user.name,
      externalAccountEmail: null,
      externalAccountImageUrl: null
    };
    let installation = await db.scmInstallation.upsert({
      where: {
        tenantOid_provider_backendOid_externalAccountId: {
          tenantOid: session.tenantOid,
          provider: i.provider,
          backendOid: backend.oid,
          externalAccountId: user.id
        }
      },
      update: data,
      create: { ...getId('scmInstallation'), ...data }
    });
    await scmInstallationSessionService.completeInstallationSession({
      sessionId: session.id,
      installationOid: installation.oid
    });
    return installation;
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
