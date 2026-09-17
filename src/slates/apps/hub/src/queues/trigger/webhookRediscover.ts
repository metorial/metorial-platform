import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { triggerWebhookTargetSearchQueue } from './webhookTargetSearch';

export let triggerWebhookRediscoverQueue = createQueue<{ cursor?: string }>({
  name: 'shub/trg/whk/rediscover/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true }
});

export let triggerWebhookRediscoverQueueProcessor = triggerWebhookRediscoverQueue.process(
  async data => {
    let instances = await db.triggerRegistrationInstance.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        triggerRegistration: { status: 'active' },
        triggerGroup: {
          spec: { path: ['invocation', 'registration', 'mode'], equals: 'auto' }
        }
      },
      orderBy: { id: 'asc' },
      take: 100
    });
    await triggerWebhookTargetSearchQueue.addManyWithOps(
      instances.map(instance => ({
        data: { triggerRegistrationInstanceId: instance.id, pageToken: null },
        opts: { id: `${instance.id}:first` }
      }))
    );
    if (instances.length === 100) {
      await triggerWebhookRediscoverQueue.add({ cursor: instances[instances.length - 1]!.id });
    }
  }
);

export let triggerWebhookRediscoverCron = createCron(
  {
    name: 'shub/trg/whk/rediscover/cron/1',
    redisUrl: env.service.REDIS_URL,
    cron: '*/15 * * * *'
  },
  async () => {
    await triggerWebhookRediscoverQueue.add({}, { id: 'first' });
  }
);
