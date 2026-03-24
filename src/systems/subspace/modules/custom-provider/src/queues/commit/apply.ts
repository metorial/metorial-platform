import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { env } from '../../env';

export let commitApplyQueue = createQueue<{
  customProviderCommitId: string;
}>({
  name: 'sub/cpr/commit/apply',
  redisUrl: env.service.REDIS_URL
});

let lock = createLock({
  name: 'sub/cpr/commit/apply/lock',
  redisUrl: env.service.REDIS_URL
});

export let commitApplyQueueProcessor = commitApplyQueue.process(async data => {
  let _commit = await db.customProviderCommit.findFirst({
    where: { id: data.customProviderCommitId },
    include: { customProvider: true }
  });
  if (!_commit) throw new QueueRetryError();

  return lock.usingLock(_commit.customProvider.id, async () => {
    let commit = await db.customProviderCommit.findFirstOrThrow({
      where: { oid: _commit.oid },
      include: {
        customProvider: true,
        targetCustomProviderVersion: true,
        toEnvironment: { include: { environment: true } }
      }
    });

    let customProvider = commit.customProvider;
    let targetVersion = commit.targetCustomProviderVersion;
    let targetGlobalEnvironment = commit.toEnvironment.environment;

    if (!customProvider.providerOid || !customProvider.providerVariantOid) return;

    if (targetVersion.status === 'deployment_failed') {
      await db.customProviderCommit.updateMany({
        where: { oid: commit.oid },
        data: {
          status: 'failed',
          errorCode: 'target_version_deployment_failed',
          errorMessage: 'The target version for this commit has failed deployment.'
        }
      });
      return;
    }

    if (
      targetVersion.status !== 'deployment_succeeded' ||
      !targetVersion.providerVersionOid ||
      !customProvider.providerOid ||
      !customProvider.providerVariantOid
    ) {
      // Re-enqueue until the target version is deployed
      await commitApplyQueue.add(data, { delay: 2500 });
    }

    await withTransaction(async db => {
      let providerEnvironment = await db.providerEnvironment.upsert({
        where: {
          environmentOid_providerOid: {
            environmentOid: targetGlobalEnvironment.oid,
            providerOid: customProvider.providerOid!
          }
        },
        create: {
          ...getId('providerEnvironment'),
          environmentOid: targetGlobalEnvironment.oid,
          providerOid: customProvider.providerOid!,
          tenantOid: commit.toEnvironment.tenantOid,
          solutionOid: commit.toEnvironment.solutionOid,
          providerVariantOid: customProvider.providerVariantOid!,
          currentVersionOid: targetVersion.providerVersionOid!
        },
        update: {
          currentVersionOid: targetVersion.providerVersionOid!
        }
      });

      let providerVersion = await db.providerEnvironmentVersion.upsert({
        where: {
          providerEnvironmentOid_providerVersionOid: {
            providerEnvironmentOid: providerEnvironment.oid,
            providerVersionOid: targetVersion.providerVersionOid!
          }
        },
        create: {
          ...getId('providerEnvironmentVersion'),
          providerEnvironmentOid: providerEnvironment.oid,
          providerVersionOid: targetVersion.providerVersionOid!,
          environmentOid: targetGlobalEnvironment.oid
        },
        update: {}
      });

      await db.customProviderEnvironmentVersion.upsert({
        where: {
          customProviderEnvironmentOid_customProviderVersionOid: {
            customProviderEnvironmentOid: commit.toEnvironmentOid,
            customProviderVersionOid: targetVersion.oid
          }
        },
        create: {
          ...getId('customProviderEnvironmentVersion'),
          customProviderEnvironmentOid: commit.toEnvironmentOid,
          customProviderVersionOid: targetVersion.oid,
          environmentOid: commit.toEnvironment.environmentOid,
          commitOid: commit.oid
        },
        update: {
          commitOid: commit.oid
        }
      });

      await db.providerVersion.updateMany({
        where: { oid: targetVersion.providerVersionOid! },
        data: { isEnvironmentLocked: true }
      });

      await db.provider.updateMany({
        where: { oid: customProvider.providerOid! },
        data: { hasEnvironments: true }
      });

      await db.customProviderCommit.updateMany({
        where: { oid: commit.oid },
        data: {
          status: 'applied',
          appliedAt: new Date()
        }
      });
    });
  });
});
