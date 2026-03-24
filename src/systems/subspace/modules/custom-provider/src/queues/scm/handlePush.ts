import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, getId, withTransaction } from '@metorial-subspace/db';
import { actorService } from '@metorial-subspace/module-tenant';
import { env } from '../../env';
import { prepareVersion } from '../../internal/createVersion';
import { handleUpcomingCustomProviderQueue } from '../upcoming/handle';

export let handlePushQueue = createQueue<{ scmRepoPushId: string; cursor?: string }>({
  name: 'sub/cpr/scm/push',
  redisUrl: env.service.REDIS_URL
});

export let handlePushQueueProcessor = handlePushQueue.process(async data => {
  let push = await db.scmRepoPush.findUnique({
    where: { id: data.scmRepoPushId }
  });
  if (!push) throw new QueueRetryError();

  let codeBuckets = await db.customProvider.findMany({
    where: {
      id: data.cursor ? { gt: data.cursor } : undefined,
      scmRepoOid: push.repoOid
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (!codeBuckets.length) return;

  await processProviderPushQueue.addMany(
    codeBuckets.map(cb => ({
      scmRepoPushId: data.scmRepoPushId,
      customProviderId: cb.id
    }))
  );

  await handlePushQueue.add({
    scmRepoPushId: data.scmRepoPushId,
    cursor: codeBuckets[codeBuckets.length - 1].id
  });
});

export let processProviderPushQueue = createQueue<{
  scmRepoPushId: string;
  customProviderId: string;
}>({
  name: 'sub/cpr/scm/push',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    limiter: {
      max: 1,
      duration: 20 * 1000
    },
    concurrency: 1
  }
});

export let processProviderPushQueueProcessor = processProviderPushQueue.process(async data => {
  let push = await db.scmRepoPush.findUnique({
    where: { id: data.scmRepoPushId }
  });
  if (!push) throw new QueueRetryError();

  let provider = await db.customProvider.findUnique({
    where: { id: data.customProviderId },
    include: { tenant: true, solution: true }
  });
  if (!provider) throw new QueueRetryError();

  let env = await db.customProviderEnvironment.findFirst({
    where: {
      customProviderOid: provider.oid,
      branchName: push.branchName
    },
    include: { environment: true }
  });
  if (!env) {
    env = await db.customProviderEnvironment.findFirst({
      where: {
        customProviderOid: provider.oid,
        environment: {
          type: 'development'
        }
      },
      include: { environment: true }
    });
  }
  if (!env) {
    env = await db.customProviderEnvironment.findFirst({
      where: {
        customProviderOid: provider.oid
      },
      include: { environment: true }
    });
  }
  if (!env) return;

  let actor = await actorService.getSystemActor({
    tenant: provider.tenant
  });

  await withTransaction(async db => {
    let versionPrep = await prepareVersion({
      actor,
      tenant: provider.tenant,
      solution: provider.solution,
      environment: env.environment,
      customProvider: provider,
      trigger: 'scm',
      repoPush: push
    });

    let upcoming = await db.upcomingCustomProvider.create({
      data: {
        ...getId('upcomingCustomProvider'),
        tenantOid: provider.tenant.oid,
        solutionOid: provider.solution.oid,
        environmentOid: env.environment.oid,
        actorOid: actor.oid,

        message: `Git push: ${push.commitMessage} (${push.sha.substring(0, 7)})`,

        type: 'create_custom_provider',

        customProviderOid: provider.oid,
        customProviderDeploymentOid: versionPrep.deployment.oid,
        customProviderVersionOid: versionPrep.version.oid,

        payload: {
          from: provider.payload.from,
          config: provider.payload.config
        }
      }
    });

    addAfterTransactionHook(async () =>
      handleUpcomingCustomProviderQueue.add({ upcomingCustomProviderId: upcoming.id })
    );
  });
});
