import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { db as metorialDb } from '@metorial/db';
import { eventTrackerService } from '@metorial/module-event-tracker';
import { env } from '../env';
import { getCallbackEventDelegate } from '../lib/eventDelegation';

export let callbackEventProcessQueue = createQueue<{ callbackEventId: string }>({
  name: 'sub/cb/event/process',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let callbackEventProcessQueueProcessor = callbackEventProcessQueue.process(
  async data => {
    let callbackEvent = await db.callbackEvent.findUnique({
      where: { id: data.callbackEventId },
      include: {
        callback: { include: { managedAdapterGlobal: true, provider: true } },
        environment: true,
        providerTrigger: true
      }
    });
    if (!callbackEvent) return;

    // Kinda useless but nice to have
    if (callbackEvent.environment.instanceOid == null) return;

    if (callbackEvent.callback.ownership === 'managed') {
      let adapterIdentifier = callbackEvent.callback.managedAdapterGlobal?.identifier;
      if (!adapterIdentifier) return;

      let delegate = getCallbackEventDelegate(adapterIdentifier);
      if (!delegate) {
        throw new Error(
          `No callback event delegate registered for adapter "${adapterIdentifier}"; the adapter module is not wired into this process`
        );
      }

      await delegate({ callbackEventId: callbackEvent.id });
      return;
    }

    let instance = await metorialDb.instance.findUnique({
      where: { oid: callbackEvent.environment.instanceOid }
    });
    if (!instance) return;

    await eventTrackerService.recordCallbackEvent({
      organizationOid: instance.organizationOid,
      instanceOid: instance.oid,
      callbackEventId: callbackEvent.id,
      callbackId: callbackEvent.callback.id,
      callbackTriggerKey: callbackEvent.providerTrigger?.key ?? null,
      providerId: callbackEvent.callback.provider.id
    });
  }
);
