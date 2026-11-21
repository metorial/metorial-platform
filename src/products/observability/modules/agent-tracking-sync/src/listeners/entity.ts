import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { isAgentTrackingEnabled } from '../lib/client';
import { shouldSyncOrganization } from '../lib/flag';
import { syncEntityQueue, type EntitySyncTarget } from '../queues/syncEntity';

let entityOrganization = async (target: EntitySyncTarget) => {
  if (target.type == 'consumer') {
    let consumer = await db.consumer.findUnique({
      where: { id: target.id },
      include: { organization: true }
    });

    return consumer?.organization ?? null;
  }

  let consumerDevice = await db.consumerDevice.findUnique({
    where: { id: target.id },
    include: { instance: { include: { organization: true } } }
  });

  return consumerDevice?.instance.organization ?? null;
};

// Some of these events fire inside the writing transaction; the jobs must read the committed
// row, and a rollback must enqueue nothing.
let enqueueEntitySync = async (target: EntitySyncTarget) => {
  if (!isAgentTrackingEnabled()) return;

  await addAfterTransactionHook(async () => {
    if (!(await shouldSyncOrganization(() => entityOrganization(target)))) return;

    await syncEntityQueue.add(target);
  });
};

Fabric.listen('consumer.created:after', async ({ consumer }) =>
  enqueueEntitySync({ type: 'consumer', id: consumer.id })
);

Fabric.listen('consumer.updated:after', async ({ consumer }) =>
  enqueueEntitySync({ type: 'consumer', id: consumer.id })
);

Fabric.listen('consumer.identity.created:after', async ({ instanceConsumer }) =>
  enqueueEntitySync({ type: 'consumer', id: instanceConsumer.consumer.id })
);

Fabric.listen('consumer.identity.updated:after', async ({ instanceConsumer }) =>
  enqueueEntitySync({ type: 'consumer', id: instanceConsumer.consumer.id })
);

Fabric.listen('consumer.profile.created:after', async ({ consumerProfile }) =>
  enqueueEntitySync({ type: 'consumer', id: consumerProfile.consumer.id })
);

Fabric.listen('consumer.profile.updated:after', async ({ consumerProfile }) =>
  enqueueEntitySync({ type: 'consumer', id: consumerProfile.consumer.id })
);

Fabric.listen('consumer.profile.deleted:after', async ({ consumerProfile }) =>
  enqueueEntitySync({ type: 'consumer', id: consumerProfile.consumer.id })
);

Fabric.listen('consumer.device.enrolled:after', async ({ consumerDevice }) =>
  enqueueEntitySync({ type: 'device', id: consumerDevice.id })
);

Fabric.listen('consumer.device.updated:after', async ({ consumerDevice }) =>
  enqueueEntitySync({ type: 'device', id: consumerDevice.id })
);
