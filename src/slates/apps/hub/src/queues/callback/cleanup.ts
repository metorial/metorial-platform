import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { triggerRegistrationService } from '../../services/triggerRegistration';

let batchSize = 100;

export let callbackInstanceCleanupManyQueue = createQueue<{
  callbackId: string;
  cursor?: string;
}>({
  name: 'shub/cb/instance/cleanupMany',
  redisUrl: env.service.REDIS_URL
});

export let callbackInstanceCleanupManyQueueProcessor = callbackInstanceCleanupManyQueue.process(
  async data => {
    let callback = await db.callback.findUnique({ where: { id: data.callbackId } });
    if (!callback) return;

    let instances = await db.callbackInstance.findMany({
      where: {
        callbackOid: callback.oid,
        status: { not: 'deleted' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true }
    });
    if (instances.length === 0) return;

    await callbackInstanceCleanupSingleQueue.addManyWithOps(
      instances.map(instance => ({
        data: { callbackInstanceId: instance.id },
        opts: { id: instance.id }
      }))
    );

    if (instances.length === batchSize) {
      await callbackInstanceCleanupManyQueue.add({
        callbackId: data.callbackId,
        cursor: instances[instances.length - 1]!.id
      });
    }
  }
);

export let callbackInstanceCleanupSingleQueue = createQueue<{ callbackInstanceId: string }>({
  name: 'shub/cb/instance/cleanupSingle',
  redisUrl: env.service.REDIS_URL
});

export let callbackInstanceCleanupSingleQueueProcessor = callbackInstanceCleanupSingleQueue.process(
  async data => {
    let callbackInstance = await db.callbackInstance.findUnique({
      where: { id: data.callbackInstanceId },
      include: { tenant: true, triggerRegistration: true }
    });
    if (!callbackInstance || callbackInstance.status === 'deleted') return;

    await db.callbackInstance.update({
      where: { oid: callbackInstance.oid },
      data: { status: 'deleted' }
    });

    await triggerRegistrationService.deleteTriggerRegistration({
      tenant: callbackInstance.tenant,
      registration: callbackInstance.triggerRegistration
    });
  }
);
