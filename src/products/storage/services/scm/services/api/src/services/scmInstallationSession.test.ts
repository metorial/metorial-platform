import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScmBackend } from '../../prisma/generated/client';

let mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    scmInstallationSession: {
      update: vi.fn()
    }
  },
  tx: {
    scmInstallationSession: {
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn()
    },
    scmBackendSetupSession: {
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('../db', () => ({ db: mocks.db }));

import { scmInstallationSessionService } from './scmInstallationSession';

describe('SCM session completion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.$transaction.mockImplementation(async complete => await complete(mocks.tx));
  });

  it('allows repeated sessions to reference the same installation', async () => {
    mocks.tx.scmInstallationSession.findUniqueOrThrow.mockResolvedValue({
      id: 'new-session',
      status: 'pending',
      installationOid: null,
      installation: null
    });
    mocks.tx.scmInstallationSession.update.mockResolvedValue({
      id: 'new-session',
      installationOid: 42n,
      installation: { oid: 42n }
    });

    await scmInstallationSessionService.completeInstallationSession({
      sessionId: 'new-session',
      installationOid: 42n
    });

    expect(mocks.tx.scmInstallationSession.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.scmInstallationSession.update).toHaveBeenCalledWith({
      where: { id: 'new-session' },
      data: { installationOid: 42n, status: 'succeeded' },
      include: { installation: true }
    });
  });

  it('does not rewrite an already-completed installation session', async () => {
    let completedSession = {
      id: 'session',
      status: 'succeeded',
      installationOid: 42n,
      installation: { oid: 42n }
    };
    mocks.tx.scmInstallationSession.findUniqueOrThrow.mockResolvedValue(completedSession);

    await expect(
      scmInstallationSessionService.completeInstallationSession({
        sessionId: 'session',
        installationOid: 42n
      })
    ).resolves.toBe(completedSession);

    expect(mocks.tx.scmInstallationSession.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.scmInstallationSession.update).not.toHaveBeenCalled();
  });

  it('retries when another callback claims the installation concurrently', async () => {
    mocks.tx.scmInstallationSession.findUniqueOrThrow.mockResolvedValue({
      id: 'session',
      status: 'pending',
      installationOid: null,
      installation: null
    });
    mocks.tx.scmInstallationSession.update.mockResolvedValue({
      id: 'session',
      installationOid: 42n,
      installation: { oid: 42n }
    });
    mocks.db.$transaction
      .mockImplementationOnce(async complete => {
        await complete(mocks.tx);
        throw { code: 'P2002' };
      })
      .mockImplementationOnce(async complete => await complete(mocks.tx));

    await expect(
      scmInstallationSessionService.completeInstallationSession({
        sessionId: 'session',
        installationOid: 42n
      })
    ).resolves.toMatchObject({ installationOid: 42n });

    expect(mocks.db.$transaction).toHaveBeenCalledTimes(2);
  });

  it('reassigns a backend setup session using the same semantics', async () => {
    mocks.tx.scmBackendSetupSession.findUniqueOrThrow.mockResolvedValue({
      id: 'new-session',
      backendOid: null,
      backend: null
    });
    mocks.tx.scmBackendSetupSession.update.mockResolvedValue({
      id: 'new-session',
      backendOid: 7n,
      backend: { oid: 7n }
    });

    await scmInstallationSessionService.completeBackendSetupSession({
      sessionId: 'new-session',
      backend: { oid: 7n } as ScmBackend
    });

    expect(mocks.tx.scmBackendSetupSession.updateMany).toHaveBeenCalledWith({
      where: { backendOid: 7n, id: { not: 'new-session' } },
      data: { backendOid: null }
    });
  });

  it('marks approval requests pending for one week', async () => {
    let now = new Date('2026-07-24T10:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.db.scmInstallationSession.update.mockResolvedValue({ id: 'session' });

    await scmInstallationSessionService.markPendingApproval({
      sessionId: 'session',
      requestId: 'request-1',
      accountId: 'account-1',
      accountLogin: 'metorial',
      accountType: 'organization',
      requesterId: 'user-1'
    });

    expect(mocks.db.scmInstallationSession.update).toHaveBeenCalledWith({
      where: { id: 'session' },
      data: expect.objectContaining({
        status: 'pending_approval',
        githubInstallationRequestId: 'request-1',
        githubPendingAccountId: 'account-1',
        githubPendingAccountLogin: 'metorial',
        githubPendingAccountType: 'organization',
        githubPendingRequesterId: 'user-1',
        githubPendingApprovalAt: now,
        expiresAt: new Date('2026-07-31T10:00:00.000Z')
      }),
      include: { installation: true, selectedBackend: true }
    });
    vi.useRealTimers();
  });
});
