import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { isAgentTrackingEnabled } from '../lib/client';
import { shouldSyncOrganization } from '../lib/flag';
import { enqueueAgentReconcile } from '../queues/reconcile';
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

let enqueueAgentCleanup = async (instanceOid: bigint) => {
  if (!isAgentTrackingEnabled()) return;

  await addAfterTransactionHook(async () => {
    let instance = await db.instance.findUnique({
      where: { oid: instanceOid },
      include: { organization: true }
    });
    let organization = instance?.organization;
    if (!organization || !(await shouldSyncOrganization(async () => organization))) return;

    await enqueueAgentReconcile(organization.id);
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

Fabric.listen(
  'consumer.device.detections.changed:after',
  async ({ consumerDevice, added, removed }) => {
    if (added.length) await enqueueEntitySync({ type: 'device', id: consumerDevice.id });
    if (removed.length) {
      await enqueueAgentCleanup(consumerDevice.instanceOid);
    }
  }
);

Fabric.listen('consumer.device.ended:after', async ({ consumerDevice }) =>
  enqueueAgentCleanup(consumerDevice.instanceOid)
);

Fabric.listen(
  'consumer.device_settings.updated:after',
  async ({ consumerDeviceSettings, previousConsumerDeviceSettings }) => {
    if (
      !previousConsumerDeviceSettings?.aiToolDetectionEnabled ||
      consumerDeviceSettings.aiToolDetectionEnabled
    ) {
      return;
    }

    await enqueueAgentCleanup(consumerDeviceSettings.instanceOid);
  }
);
