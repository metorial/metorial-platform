import { addAfterTransactionHook } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { isAgentTelemetryEnabled } from '../internal/groundstation';
import { revokeDeviceIngestTokensQueue } from '../queues/revokeTokens';
import { syncEntityQueue, type EntitySyncTarget } from '../queues/syncEntity';

// Some of these events fire inside the writing transaction (device end does); the jobs must
// read the committed row, and a rollback must enqueue nothing.
let enqueueEntitySync = async (target: EntitySyncTarget) => {
  if (!isAgentTelemetryEnabled()) return;

  await addAfterTransactionHook(() => syncEntityQueue.add(target));
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

Fabric.listen('consumer.device.ended:after', async ({ consumerDevice }) => {
  if (!isAgentTelemetryEnabled()) return;

  await addAfterTransactionHook(async () => {
    await syncEntityQueue.add({ type: 'device', id: consumerDevice.id });
    await revokeDeviceIngestTokensQueue.add({ consumerDeviceId: consumerDevice.id });
  });
});
