import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { triggerRegistrationInstanceSetupQueue } from './setup';

let batchSize = 100;

export let triggerWebhookRegistrationRematchQueue = createQueue<{
  webhookRegistrationId: string;
  cursor?: string;
}>({
  name: 'shub/trg/whk/rematch',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let triggerWebhookRegistrationRematchQueueProcessor =
  triggerWebhookRegistrationRematchQueue.process(async data => {
    let registration = await db.slateWebhookRegistration.findUnique({
      where: { id: data.webhookRegistrationId },
      select: { triggerGroupOid: true, tenantOid: true }
    });
    if (!registration || !registration.tenantOid) return;

    let instances = await db.triggerRegistrationInstance.findMany({
      where: {
        triggerRegistration: { tenantOid: registration.tenantOid },

        // Same trigger group means we don't match polling or auto webhook
        // instances - so we don't need to worry about handling those here.
        triggerGroupOid: registration.triggerGroupOid,

        webhooks: { none: {} },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true }
    });
    if (instances.length === 0) return;

    await triggerRegistrationInstanceSetupQueue.addManyWithOps(
      instances.map(instance => ({
        data: { triggerRegistrationInstanceId: instance.id },
        opts: { id: instance.id }
      }))
    );

    if (instances.length === batchSize) {
      await triggerWebhookRegistrationRematchQueue.add({
        webhookRegistrationId: data.webhookRegistrationId,
        cursor: instances[instances.length - 1]!.id
      });
    }
  });
