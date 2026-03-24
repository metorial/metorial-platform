import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, withTransaction } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '@metorial-subspace/provider-shuttle/src/client';
import { upsertShuttleServerVersion } from '@metorial-subspace/provider-shuttle/src/lib/upsertShuttleVersion';
import { env } from '../../env';
import { ensureEnvironments } from '../../internal/ensureEnvironments';
import { linkNewShuttleVersionToCustomProvider } from '../../internal/linkVersion';
import { commitApplyQueue } from '../commit/apply';
import { customDeploymentPropagateToOtherEnvironmentsQueue } from './propagateToOtherEnvironments';

export let customDeploymentSucceededQueue = createQueue<{
  customProviderDeploymentId: string;
}>({
  name: 'sub/cpr/deployment/succeeded',
  redisUrl: env.service.REDIS_URL
});

export let customDeploymentSucceededQueueProcessor = customDeploymentSucceededQueue.process(
  async data => {
    let deployment = await db.customProviderDeployment.findFirst({
      where: { id: data.customProviderDeploymentId },
      include: {
        tenant: true,
        customProviderVersion: true,
        shuttleCustomServer: { include: { server: true } },
        shuttleServerVersion: true,
        sourceEnvironment: true,
        commit: true
      }
    });
    let customProviderVersion = deployment?.customProviderVersion;
    let shuttleServerRecord = deployment?.shuttleCustomServer?.server;
    let shuttleServerVersionRecord = deployment?.shuttleServerVersion;
    let sourceEnvironment = deployment?.sourceEnvironment;
    let commit = deployment?.commit;

    if (!deployment) throw new QueueRetryError();
    if (
      !customProviderVersion ||
      !shuttleServerRecord ||
      !shuttleServerVersionRecord ||
      !sourceEnvironment ||
      !commit
    )
      return;

    let tenant = await getTenantForShuttle(deployment.tenant);

    let shuttleServer = await shuttle.server.get({
      serverId: shuttleServerRecord!.id,
      tenantId: tenant.id
    });
    let shuttleServerVersion = await shuttle.serverVersion.get({
      serverVersionId: shuttleServerVersionRecord!.id,
      tenantId: tenant.id
    });

    await withTransaction(async db => {
      let versionRes = await upsertShuttleServerVersion({
        shuttleServer,
        shuttleServerVersion,

        shuttleServerRecord,
        shuttleServerVersionRecord
      });

      await linkNewShuttleVersionToCustomProvider({
        ...versionRes,
        customProviderVersion
      });

      await ensureEnvironments(customProviderVersion);

      let sourceEnvFull = await db.customProviderEnvironment.findUniqueOrThrow({
        where: { oid: sourceEnvironment.oid },
        include: {
          providerEnvironment: {
            include: {
              currentVersion: {
                include: { customProviderVersion: true }
              }
            }
          }
        }
      });

      await db.customProviderCommit.updateMany({
        where: { oid: commit.oid },
        data: {
          toEnvironmentOid: sourceEnvFull.oid,
          toEnvironmentVersionBeforeOid:
            sourceEnvFull.providerEnvironment?.currentVersion?.customProviderVersion?.oid
        }
      });

      await addAfterTransactionHook(() =>
        commitApplyQueue.add({ customProviderCommitId: commit.id })
      );

      await addAfterTransactionHook(() =>
        customDeploymentPropagateToOtherEnvironmentsQueue.add({
          customProviderDeploymentId: deployment.id
        })
      );

      await db.customProviderDeployment.updateMany({
        where: { id: deployment.id },
        data: {
          status: 'succeeded',
          startedAt: deployment.startedAt ?? new Date(),
          endedAt: deployment.endedAt ?? new Date()
        }
      });
    });
  }
);
