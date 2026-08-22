import { isServiceError } from '@lowerdeck/error';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';

export let callbackConfigBackingDeleteQueue = createQueue<{
  callbackConfigVersionId: string;
}>({
  name: 'sub/callback/config/backing-delete',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let callbackConfigBackingDeleteQueueProcessor =
  callbackConfigBackingDeleteQueue.process(async data => {
    let version = await db.callbackConfigVersion.findUnique({
      where: { id: data.callbackConfigVersionId },
      include: {
        callbackConfig: {
          include: { tenant: true }
        },
        slateCallbackConfig: true
      }
    });
    if (!version || !version.slateCallbackConfigOid) return;
    if (version.callbackConfig.currentVersionOid === version.oid) return;

    try {
      let backend = await getBackend({ entity: { backendOid: version.backendOid } });
      await backend.callbackConfig.deleteCallbackConfig({
        tenant: version.callbackConfig.tenant,
        backing: { slateCallbackConfigOid: version.slateCallbackConfigOid }
      });
    } catch (error) {
      if (!isServiceError(error) || error.data.code !== 'not_found') {
        throw new QueueRetryError();
      }
    }

    try {
      await db.$transaction(async tx => {
        let current = await tx.callbackConfigVersion.findUnique({
          where: { oid: version.oid },
          include: { callbackConfig: true }
        });
        if (!current || !current.slateCallbackConfigOid) return;
        if (current.callbackConfig.currentVersionOid === current.oid) return;

        let slateCallbackConfigOid = current.slateCallbackConfigOid;
        await tx.callbackConfigVersion.update({
          where: { oid: current.oid },
          data: { slateCallbackConfigOid: null }
        });
        await tx.slateCallbackConfig.deleteMany({
          where: { oid: slateCallbackConfigOid }
        });
      });
    } catch (error) {
      throw new QueueRetryError();
    }
  });
