import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { randomBytes } from 'crypto';
import type {
  Actor,
  ScmBackend,
  ScmBackendType,
  ScmInstallationSession,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

type ScmSessionTransaction = Pick<
  typeof db,
  'scmInstallationSession' | 'scmBackendSetupSession'
>;

class ScmInstallationSessionServiceImpl {
  async createInstallationSession(d: { tenant: Tenant; actor: Actor; redirectUrl?: string }) {
    let state = randomBytes(32).toString('hex');
    let expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    return await db.scmInstallationSession.create({
      data: {
        ...getId('scmInstallationSession'),
        tenantOid: d.tenant.oid,
        ownerActorOid: d.actor.oid,
        redirectUrl: d.redirectUrl,
        state,
        expiresAt
      },
      include: { installation: true }
    });
  }

  async getInstallationSession(d: {
    sessionId: string;
    tenant: Tenant;
    allowExpired?: boolean;
  }) {
    let session = await db.scmInstallationSession.findUnique({
      where: { id: d.sessionId, tenantOid: d.tenant.oid },
      include: { installation: true }
    });

    if (!session) {
      throw new ServiceError(notFoundError('scm_installation_session'));
    }

    if (!d.allowExpired && session.expiresAt < new Date()) {
      throw new ServiceError(badRequestError({ message: 'Installation session expired' }));
    }

    return session;
  }

  async getInstallationSessionPublic(d: { sessionId: string; allowExpired?: boolean }) {
    let session = await db.scmInstallationSession.findUnique({
      where: { id: d.sessionId },
      include: { tenant: true, installation: true, selectedBackend: true }
    });

    if (!session) {
      throw new ServiceError(notFoundError('scm_installation_session'));
    }

    if (!d.allowExpired && session.expiresAt < new Date()) {
      throw new ServiceError(badRequestError({ message: 'Installation session expired' }));
    }

    return session;
  }

  async setGitHubInstallationRequestBaseline(d: { sessionId: string; requestIds: string[] }) {
    return await db.scmInstallationSession.update({
      where: { id: d.sessionId },
      data: { githubInstallationRequestBaselineIds: d.requestIds }
    });
  }

  async markPendingApproval(d: {
    sessionId: string;
    requestId?: string;
    accountId?: string;
    accountLogin?: string;
    accountType?: 'user' | 'organization';
    requesterId?: string;
  }) {
    let now = new Date();
    return await db.scmInstallationSession.update({
      where: { id: d.sessionId },
      data: {
        status: 'pending_approval',
        githubInstallationRequestId: d.requestId,
        githubPendingAccountId: d.accountId,
        githubPendingAccountLogin: d.accountLogin,
        githubPendingAccountType: d.accountType,
        githubPendingRequesterId: d.requesterId,
        githubPendingApprovalAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      },
      include: { installation: true, selectedBackend: true }
    });
  }

  async getInstallationSessionByState(d: { state: string }) {
    let session = await db.scmInstallationSession.findUnique({
      where: { state: d.state },
      include: { tenant: true, ownerActor: true, installation: true }
    });

    if (!session) {
      throw new ServiceError(notFoundError('scm_installation_session'));
    }

    if (session.expiresAt < new Date()) {
      throw new ServiceError(badRequestError({ message: 'Installation session expired' }));
    }

    return session;
  }

  async completeInstallationSession(d: { sessionId: string; installationOid: bigint }) {
    return await this.completeSessionWithRetry(async tx => {
      let session = await tx.scmInstallationSession.findUniqueOrThrow({
        where: { id: d.sessionId },
        include: { installation: true }
      });

      if (session.installationOid === d.installationOid && session.status === 'succeeded') {
        return session;
      }

      return await tx.scmInstallationSession.update({
        where: { id: d.sessionId },
        data: { installationOid: d.installationOid, status: 'succeeded' },
        include: { installation: true }
      });
    });
  }

  async createBackendSetupSession(d: {
    tenant: Tenant;
    type: ScmBackendType;
    parentInstallationSession?: ScmInstallationSession;
    redirectUrl?: string;
  }) {
    let state = randomBytes(32).toString('hex');
    let expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    return await db.scmBackendSetupSession.create({
      data: {
        ...getId('scmBackendSetupSession'),
        tenantOid: d.tenant.oid,
        type: d.type,
        parentInstallationSessionOid: d.parentInstallationSession?.oid,
        redirectUrl: d.redirectUrl,
        state,
        expiresAt
      },
      include: { parentInstallationSession: true, backend: true }
    });
  }

  async getBackendSetupSession(d: { sessionId: string; tenant: Tenant }) {
    let session = await db.scmBackendSetupSession.findUnique({
      where: { id: d.sessionId, tenantOid: d.tenant.oid },
      include: { parentInstallationSession: true, backend: true }
    });

    if (!session) {
      throw new ServiceError(notFoundError('scm_backend_setup_session'));
    }

    if (session.expiresAt < new Date()) {
      throw new ServiceError(badRequestError({ message: 'Backend setup session expired' }));
    }

    return session;
  }

  async getBackendSetupSessionPublic(d: { sessionId: string }) {
    let session = await db.scmBackendSetupSession.findUnique({
      where: { id: d.sessionId },
      include: { parentInstallationSession: true, backend: true }
    });

    if (!session) {
      throw new ServiceError(notFoundError('scm_backend_setup_session'));
    }

    if (session.expiresAt < new Date()) {
      throw new ServiceError(badRequestError({ message: 'Backend setup session expired' }));
    }

    return session;
  }

  async completeBackendSetupSession(d: { sessionId: string; backend: ScmBackend }) {
    return await this.completeSessionWithRetry(async tx => {
      let session = await tx.scmBackendSetupSession.findUniqueOrThrow({
        where: { id: d.sessionId },
        include: { backend: true }
      });

      if (session.backendOid === d.backend.oid) return session;

      await tx.scmBackendSetupSession.updateMany({
        where: {
          backendOid: d.backend.oid,
          id: { not: d.sessionId }
        },
        data: { backendOid: null }
      });

      return await tx.scmBackendSetupSession.update({
        where: { id: d.sessionId },
        data: { backendOid: d.backend.oid },
        include: { backend: true }
      });
    });
  }

  private async completeSessionWithRetry<T>(
    complete: (tx: ScmSessionTransaction) => Promise<T>
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await db.$transaction(complete);
      } catch (error) {
        if (attempt === 1 || !this.isUniqueConstraintError(error)) throw error;
      }
    }

    throw new Error('Unreachable');
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
    );
  }

  async getAvailableBackends(d: { tenant: Tenant }): Promise<ScmBackend[]> {
    return await db.scmBackend.findMany({
      where: {
        OR: [{ isDefault: true, tenantOid: null }, { tenantOid: d.tenant.oid }]
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
  }
}

export let scmInstallationSessionService = Service.create(
  'scmInstallationSession',
  () => new ScmInstallationSessionServiceImpl()
).build();
