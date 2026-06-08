import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { getId } from '../../id';
import { deployContainerServerStartQueue } from '../container/startDeployment';
import { serverVersionCreatedQueue } from '../lifecycle/serverVersion';

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn((handler: (data: unknown) => Promise<void>) => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'QueueRetryError';
    }
  }
}));

vi.mock('../container/startDeployment', () => ({
  deployContainerServerStartQueue: { add: vi.fn() }
}));

vi.mock('../lifecycle/serverVersion', () => ({
  serverVersionCreatedQueue: { add: vi.fn() }
}));

let propagateRepoVersionToServerQueueProcessor: (
  data: {
    repositoryVersionId: string;
    repositoryTagId: string;
    serverId: string;
    serverDeploymentId?: string;
  }
) => Promise<void>;

let propagateRepoVersionToServersQueueProcessor: (data: {
  repositoryTagId: string;
  repositoryVersionId: string;
  serverDeploymentId?: string;
}) => Promise<void>;

describe('propagateRepoVersionToServerQueueProcessor', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanDatabase();

    vi.resetModules();
    let module = await import('./serverVersion');
    propagateRepoVersionToServerQueueProcessor =
      module.propagateRepoVersionToServerQueueProcessor as typeof propagateRepoVersionToServerQueueProcessor;
    propagateRepoVersionToServersQueueProcessor =
      module.propagateRepoVersionToServersQueueProcessor as typeof propagateRepoVersionToServersQueueProcessor;
  });

  let setupLinkedServer = async (opts: { global: boolean }) => {
    let tenant = await f.tenant.default();
    let tag = await f.containerRepositoryTag.withRepository({ tenantOid: tenant.oid });
    let repositoryVersion = await f.containerRepositoryVersion.default({
      repositoryOid: tag.repositoryOid,
      tenantOid: tenant.oid
    });

    await testDb.containerRepositoryTag.update({
      where: { oid: tag.oid },
      data: {
        currentVersionOid: repositoryVersion.oid,
        discoveryStatus: 'succeeded'
      }
    });

    let server = opts.global
      ? await f.server.global({ overrides: { draftRepositoryTagOid: tag.oid } })
      : await f.server.default({
          tenantOid: tenant.oid,
          overrides: { draftRepositoryTagOid: tag.oid }
        });

    return { tenant, tag, repositoryVersion, server };
  };

  it('skips cron-triggered propagation for global servers', async () => {
    let { tag, repositoryVersion, server } = await setupLinkedServer({ global: true });

    await propagateRepoVersionToServerQueueProcessor({
      repositoryVersionId: repositoryVersion.id,
      repositoryTagId: tag.id,
      serverId: server.id
    });

    let versions = await testDb.serverVersion.findMany({ where: { serverOid: server.oid } });
    let deployments = await testDb.serverDeployment.findMany({ where: { serverOid: server.oid } });

    expect(versions).toHaveLength(0);
    expect(deployments).toHaveLength(0);
    expect(deployContainerServerStartQueue.add).not.toHaveBeenCalled();
  });

  it('propagates to global servers when triggered by a specific deployment', async () => {
    let { tag, repositoryVersion, server } = await setupLinkedServer({ global: true });
    let deployment = await testDb.serverDeployment.create({
      data: {
        ...getId('serverDeployment'),
        status: 'queued',
        serverOid: server.oid,
        tenantOid: null
      }
    });

    await propagateRepoVersionToServerQueueProcessor({
      repositoryVersionId: repositoryVersion.id,
      repositoryTagId: tag.id,
      serverId: server.id,
      serverDeploymentId: deployment.id
    });

    let versions = await testDb.serverVersion.findMany({ where: { serverOid: server.oid } });

    expect(versions).toHaveLength(1);
    expect(versions[0]?.repositoryVersionOid).toBe(repositoryVersion.oid);
    expect(deployContainerServerStartQueue.add).not.toHaveBeenCalled();
    expect(serverVersionCreatedQueue.add).toHaveBeenCalled();
  });

  it('propagates cron-triggered digest changes to tenant servers', async () => {
    let { tag, repositoryVersion, server } = await setupLinkedServer({ global: false });

    await propagateRepoVersionToServerQueueProcessor({
      repositoryVersionId: repositoryVersion.id,
      repositoryTagId: tag.id,
      serverId: server.id
    });

    let versions = await testDb.serverVersion.findMany({ where: { serverOid: server.oid } });
    let deployments = await testDb.serverDeployment.findMany({ where: { serverOid: server.oid } });

    expect(versions).toHaveLength(1);
    expect(deployments).toHaveLength(1);
    expect(deployContainerServerStartQueue.add).toHaveBeenCalled();
    expect(serverVersionCreatedQueue.add).toHaveBeenCalled();
  });

  it('excludes global servers from cron-triggered batch propagation', async () => {
    let { tag, repositoryVersion, server } = await setupLinkedServer({ global: true });

    await propagateRepoVersionToServersQueueProcessor({
      repositoryTagId: tag.id,
      repositoryVersionId: repositoryVersion.id
    });

    let versions = await testDb.serverVersion.findMany({ where: { serverOid: server.oid } });
    expect(versions).toHaveLength(0);
  });
});
