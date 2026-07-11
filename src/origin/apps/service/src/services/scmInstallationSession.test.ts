import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScmBackend } from '../../prisma/generated/client';

let mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn()
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

  it('reassigns an installation from an older session', async () => {
    mocks.tx.scmInstallationSession.findUniqueOrThrow.mockResolvedValue({
      id: 'new-session',
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

    expect(mocks.tx.scmInstallationSession.updateMany).toHaveBeenCalledWith({
      where: { installationOid: 42n, id: { not: 'new-session' } },
      data: { installationOid: null }
    });
    expect(mocks.tx.scmInstallationSession.update).toHaveBeenCalledWith({
      where: { id: 'new-session' },
      data: { installationOid: 42n },
      include: { installation: true }
    });
  });

  it('does not rewrite an already-completed installation session', async () => {
    let completedSession = {
      id: 'session',
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
});
