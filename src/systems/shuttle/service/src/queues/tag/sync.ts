import { createCron } from '@lowerdeck/cron';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { resolveImageDigest } from '../../lib/docker/resolveDigest';
import { secretService } from '../../services/secret';
import { propagateRepoVersionToServersQueue } from './serverVersion';

export let syncTagsCron = createCron(
  {
    name: 'shut/rep-tag/sync/cron',
    cron: '*/5 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await syncTagsQueue.add({});
  }
);

let syncTagsQueue = createQueue<{ cursor?: string }>({
  name: 'shut/rep-tag/sync/many',
  redisUrl: env.service.REDIS_URL
});

export let syncTagsQueueProcessor = syncTagsQueue.process(async data => {
  let tags = await db.containerRepositoryTag.findMany({
    where: {
      id: data.cursor ? { gt: data.cursor } : undefined,
      type: 'tag'
    },
    take: 100,
    orderBy: { id: 'asc' },
    select: { id: true }
  });
  if (tags.length === 0) return;

  await syncTagQueue.addManyWithOps(
    tags.map(tag => ({ data: { tagId: tag.id }, opts: { id: tag.id } }))
  );

  await syncTagsQueue.add({ cursor: tags[tags.length - 1]!.id });
});

export let syncTagQueue = createQueue<{ tagId: string; serverDeploymentId?: string }>({
  name: 'shut/rep-tag/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000
    }
  }
});

export let syncTagQueueProcessor = syncTagQueue.process(async data => {
  let tag = await db.containerRepositoryTag.findFirst({
    where: { id: data.tagId },
    include: {
      repository: { include: { registry: { include: { secret: true } } } },
      tenant: true
    }
  });
  if (!tag) throw new QueueRetryError();

  let digest = tag.digest;

  try {
    if (!digest) {
      let secret = tag.repository.registry.secret;
      let decryptedAuth =
        secret && tag.tenant
          ? await secretService.DANGEROUSLY_decryptSecret({
              secret,
              tenant: tag.tenant,
              purpose: 'registry_credentials',
              note: `tag.sync:${tag.id}:${tag.repository.registry.id}`
            })
          : undefined;

      digest = await resolveImageDigest({
        registry: tag.repository.registry.url,
        repository: tag.repository.name,
        tag: tag.tag!,

        username: decryptedAuth?.username,
        password: decryptedAuth?.password
      });
    }
  } catch (err) {
    let error = await db.containerRepositoryTagDiscoveryError.create({
      data: {
        ...getId('repositoryTagDiscoveryError'),
        code: 'discovery_failed',
        message: err instanceof Error ? err.message : String(err),
        repositoryTagOid: tag.oid
      }
    });

    await db.containerRepositoryTag.updateMany({
      where: { oid: tag.oid },
      data: {
        discoveryStatus: 'failed',
        lastDiscoveryErrorOid: error.oid,
        lastSyncedAt: new Date()
      }
    });

    return;
  }

  let version = await db.containerRepositoryVersion.upsert({
    where: {
      repositoryOid_digest: {
        repositoryOid: tag.repositoryOid,
        digest: digest!
      }
    },
    create: {
      ...getId('repositoryVersion'),
      repositoryOid: tag.repositoryOid,
      tenantOid: tag.tenantOid,
      digest: digest!
    },
    update: {}
  });

  await db.containerRepositoryTagVersion.createMany({
    skipDuplicates: true,
    data: {
      oid: snowflake.nextId(),
      repositoryTagOid: tag.oid,
      repositoryVersionOid: version.oid
    }
  });

  let isNewVersion = tag.currentVersionOid !== version.oid;

  await db.containerRepositoryTag.updateMany({
    where: { oid: tag.oid },
    data: {
      discoveryStatus: 'succeeded',
      currentVersionOid: version.oid,
      lastDiscoveryErrorOid: null,
      lastSyncedAt: new Date()
    }
  });

  // Only propagate to servers if the digest actually changed, or if this
  // sync was triggered by a specific deployment that needs to be notified.
  if (isNewVersion || data.serverDeploymentId) {
    await propagateRepoVersionToServersQueue.add({
      repositoryTagId: tag.id,
      repositoryVersionId: version.id,
      serverDeploymentId: data.serverDeploymentId
    });
  }
});
