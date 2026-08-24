import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { TRIGGER_POLL_MIN_INTERVAL_SECONDS } from './_config';

export let triggerRegistrationInstanceSetupQueue = createQueue<{
  triggerRegistrationInstanceId: string;
}>({
  name: 'shub/trg/inst/setup',
  redisUrl: env.service.REDIS_URL
});

export let triggerRegistrationInstanceSetupQueueProcessor =
  triggerRegistrationInstanceSetupQueue.process(async data => {
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include: { triggerGroup: true, schedule: true }
    });
    if (!instance || instance.schedule) return;

    let invocation = instance.triggerGroup.spec.invocation;

    if (invocation.type === 'polling') {
      let intervalSeconds = Math.max(
        invocation.intervalSeconds,
        TRIGGER_POLL_MIN_INTERVAL_SECONDS
      );

      await db.triggerRegistrationSchedule.create({
        data: {
          ...getId('triggerRegistrationSchedule'),
          triggerRegistrationInstanceOid: instance.oid,
          intervalSeconds,
          firstRunAt: null,
          lastRunAt: null,
          nextRunAt: new Date()
        }
      });

      return;
    }

    // invocation.type === 'webhook' - nothing to set up here. Webhook trigger groups are
    // activated by creating a SlateWebhookRegistration separately (see
    // slateWebhookRegistrationService); a bare TriggerRegistration doesn't drive that.
  });
