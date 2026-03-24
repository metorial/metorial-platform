import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, snowflake } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '@metorial-subspace/provider-shuttle/src/client';
import { env } from '../../env';
import { customDeploymentFailedQueue } from './failed';
import { customDeploymentSucceededQueue } from './succeeded';

export let customDeploymentMonitorQueue = createQueue<{
  customProviderDeploymentId: string;
}>({
  name: 'sub/cpr/deployment/monitor',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

let shuttleServerVersionUpsertLock = createLock({
  name: 'sub/shut/serverVersion/upsert/lock',
  redisUrl: env.service.REDIS_URL
});

export let customDeploymentMonitorQueueProcessor = customDeploymentMonitorQueue.process(
  async data => {
    let deployment = await db.customProviderDeployment.findFirst({
      where: { id: data.customProviderDeploymentId },
      include: {
        shuttleCustomServerDeployment: true,
        tenant: true,
        shuttleCustomServer: { include: { server: true } }
      }
    });
    if (!deployment) throw new QueueRetryError();

    let shuttleDeploymentRecord = deployment.shuttleCustomServerDeployment;
    let shuttleCustomServerRecord = deployment.shuttleCustomServer;
    let shuttleServerRecord = shuttleCustomServerRecord?.server;
    if (!shuttleDeploymentRecord || !shuttleCustomServerRecord || !shuttleServerRecord) return;

    let shuttleTenant = await getTenantForShuttle(deployment.tenant);
    let shuttleDeployment = await shuttle.serverDeployment.get({
      tenantId: shuttleTenant.id,
      serverDeploymentId: shuttleDeploymentRecord.id
    });

    if (
      (shuttleDeployment.status === 'deploying' || shuttleDeployment.status === 'queued') &&
      shuttleDeployment.status !== deployment.status
    ) {
      let updated = await db.customProviderDeployment.update({
        where: { id: deployment.id },
        data: {
          startedAt: shuttleDeployment.startedAt,
          endedAt: shuttleDeployment.endedAt,
          status: shuttleDeployment.status
        }
      });

      if (shuttleDeployment.status === 'deploying') {
        await db.customProviderVersion.updateMany({
          where: { deploymentOid: deployment.oid },
          data: { status: 'deploying' }
        });
      }

      deployment = { ...deployment, ...updated };
    }

    if (shuttleDeployment.status === 'failed') {
      await customDeploymentFailedQueue.add({
        customProviderDeploymentId: deployment.id
      });
      return;
    }

    if (shuttleDeployment.status === 'succeeded') {
      // Wait for the version to be available
      if (shuttleDeployment.serverVersionId) {
        let shuttleVersion = await shuttle.serverVersion.get({
          tenantId: shuttleTenant.id,
          serverVersionId: shuttleDeployment.serverVersionId
        });

        try {
          let shuttleServerVersionRecord = await db.shuttleServerVersion.upsert({
            where: { id: shuttleVersion.id },
            create: {
              oid: snowflake.nextId(),
              id: shuttleVersion.id,
              version: shuttleVersion.id,
              identifier: `${shuttleServerRecord.id}::${shuttleVersion.id}`,
              serverOid: shuttleServerRecord.oid
            },
            update: {}
          });

          await db.customProviderDeployment.updateMany({
            where: { id: deployment.id },
            data: { shuttleServerVersionOid: shuttleServerVersionRecord.oid }
          });

          await customDeploymentSucceededQueue.add({
            customProviderDeploymentId: deployment.id
          });
          return;
        } catch (err) {
          throw new QueueRetryError();
        }
      }
    }

    await customDeploymentMonitorQueue.add(
      { customProviderDeploymentId: deployment.id },
      { delay: 2000 }
    );
  }
);
