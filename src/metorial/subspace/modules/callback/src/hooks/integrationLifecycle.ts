import { Fabric } from '@metorial/fabric';
import {
  callbackFanoutQueue,
  callbackIntegrationReconcileQueue,
  callbackProviderReconcileQueue
} from '../queues/integrationReconcile';

let registered = false;

export let registerIntegrationLifecycleHooks = () => {
  if (registered) return;
  registered = true;

  Fabric.listen(
    'provider.integration_instance_provider.version_changed:after',
    async event => {
      await callbackIntegrationReconcileQueue.add({
        integrationInstanceProviderId: event.integrationInstanceProviderId,
        targetVersionId: event.toVersionId
      });
    }
  );
  Fabric.listen('provider.integration_instance_provider.archived:after', async event => {
    await callbackIntegrationReconcileQueue.add({
      integrationInstanceProviderId: event.integrationInstanceProvider.id,
      archived: true
    });
  });
  Fabric.listen('provider.callback.created:after', async event => {
    await callbackFanoutQueue.add({ callbackId: event.callback.id });
  });
  Fabric.listen('provider.callback.updated:after', async event => {
    await callbackFanoutQueue.add({ callbackId: event.callback.id });
  });
  Fabric.listen('provider.integration_provider.updated:after', async event => {
    await callbackProviderReconcileQueue.add({
      integrationProviderId: event.integrationProvider.id
    });
  });
  Fabric.listen('provider.integration_provider.archived:after', async event => {
    await callbackProviderReconcileQueue.add({
      integrationProviderId: event.integrationProvider.id,
      archived: true
    });
  });
  Fabric.listen('provider.integration_instance.deleted:after', async event => {
    await callbackIntegrationReconcileQueue.add({
      integrationInstanceId: event.integrationInstance.id
    });
  });
};
