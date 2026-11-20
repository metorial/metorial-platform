import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  agentTrackingSyncService,
  isAgentTrackingEnabled,
  shouldSyncOrganization
} from '@metorial/module-agent-tracking-sync';
import { revokeDeviceIngestTokensQueue } from '../queues/revokeTokens';

// Device end fires inside the writing transaction; the jobs must read the committed row, and a
// rollback must enqueue nothing. Tokens are revoked whatever the flag says.
Fabric.listen('consumer.device.ended:after', async ({ consumerDevice }) => {
  if (!isAgentTrackingEnabled()) return;

  await addAfterTransactionHook(async () => {
    let sync = await shouldSyncOrganization(async () => {
      let instance = await db.instance.findUnique({
        where: { oid: consumerDevice.instanceOid },
        include: { organization: true }
      });

      return instance?.organization;
    });
    if (sync) {
      await agentTrackingSyncService.syncEntities({
        entities: [{ type: 'device', id: consumerDevice.id }]
      });
    }

    await revokeDeviceIngestTokensQueue.add({ consumerDeviceId: consumerDevice.id });
  });
});
