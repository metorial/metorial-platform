import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { versionIdentifier } from '../../lib/identifier/version';
import { addAfterTransactionHook, withTransaction } from '../../transaction';
import { deployContainerServerStartQueue } from '../container/startDeployment';
import { serverVersionCreatedQueue } from '../lifecycle/serverVersion';

export let propagateRepoVersionToServersQueue = createQueue<{
  cursor?: string;
  repositoryTagId: string;
  repositoryVersionId: string;
  serverDeploymentId?: string;
}>({
  name: 'shut/tag-serv/prop/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

export let propagateRepoVersionToServersQueueProcessor =
  propagateRepoVersionToServersQueue.process(async data => {
    let servers = await db.server.findMany({
      where: {
        draftRepositoryTag: {
          id: data.repositoryTagId
        },
        id: data.cursor ? { gt: data.cursor } : undefined,
        serverDeployments: data.serverDeploymentId
          ? {
              some: { id: data.serverDeploymentId }
            }
          : undefined
      },
      take: 100,
      orderBy: { id: 'asc' },
      select: { id: true }
    });
    if (servers.length === 0) return;

    await propagateRepoVersionToServerQueue.addManyWithOps(
      servers.map(server => ({
        data: {
          repositoryVersionId: data.repositoryVersionId,
          repositoryTagId: data.repositoryTagId,
          serverId: server.id,
          serverDeploymentId: data.serverDeploymentId
        },
        opts: { id: server.id }
      }))
    );

    await propagateRepoVersionToServersQueue.add({
      ...data,
      cursor: servers[servers.length - 1]!.id
    });
  });

let propagateRepoVersionToServerQueue = createQueue<{
  repositoryVersionId: string;
  repositoryTagId: string;
  serverId: string;
  serverDeploymentId?: string;
}>({
  name: 'shut/tag-serv/prop',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

export let propagateRepoVersionToServerQueueProcessor =
  propagateRepoVersionToServerQueue.process(async data => {
    let server = await db.server.findFirst({
      where: { id: data.serverId },
      include: { draftRepositoryTag: true }
    });
    if (!server) throw new QueueRetryError();

    if (!server.draftRepositoryTag || server.draftRepositoryTag.id != data.repositoryTagId) {
      // Tag changed, skip
      return;
    }

    let repositoryVersion = await db.containerRepositoryVersion.findFirst({
      where: { id: data.repositoryVersionId }
    });
    if (!repositoryVersion) throw new QueueRetryError();

    let identifier = versionIdentifier.docker({
      server,
      repositoryVersion,
      repositoryTag: server.draftRepositoryTag
    });

    // If this is a cron-triggered propagation (no specific deployment), check
    // whether this server already has a version for this tag+digest combination.
    // If so, skip entirely to avoid creating useless deployment records.
    if (!data.serverDeploymentId) {
      let existingVersion = await db.serverVersion.findUnique({
        where: {
          serverOid_identifier: { serverOid: server.oid, identifier }
        }
      });
      if (existingVersion) return;
    }

    await withTransaction(async db => {
      let newId = getId('serverVersion');

      let serverDeployment = data.serverDeploymentId
        ? await db.serverDeployment.findFirst({
            where: { id: data.serverDeploymentId }
          })
        : await db.serverDeployment.create({
            data: {
              ...getId('serverDeployment'),
              status: 'queued',
              serverOid: server.oid,
              tenantOid: server.tenantOid
            }
          });

      if (!serverDeployment) return;

      let version = await db.serverVersion.upsert({
        where: {
          serverOid_identifier: { serverOid: server.oid, identifier }
        },
        create: {
          ...newId,

          identifier,

          configSchema: server.draftConfigSchema,
          configTransformer: server.draftConfigTransformer,

          serverOid: server.oid,
          tenantOid: server.tenantOid,
          repositoryTagOid: server.draftRepositoryTag!.oid,
          repositoryVersionOid: repositoryVersion.oid,
          deploymentOid: serverDeployment?.oid
        },
        update: {
          repositoryVersionOid: repositoryVersion.oid
        }
      });

      if (!data.serverDeploymentId) {
        await deployContainerServerStartQueue.add({
          serverDeploymentId: serverDeployment.id,
          from: {
            type: 'repository_tag',
            repositoryTagId: server.draftRepositoryTag!.id,
            digest: repositoryVersion.digest
          }
        });
      }

      if (version.oid == newId.oid) {
        await addAfterTransactionHook(() =>
          serverVersionCreatedQueue.add({
            serverVersionId: version.id
          })
        );
      }
    });
  });
