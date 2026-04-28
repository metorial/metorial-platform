import { Service } from '@lowerdeck/service';
import { callbackRegistrationReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import { callbackV2MigrationScanQueue } from '../reconciler';

class callbackRegistrationServiceImpl {
  async enqueueReconcile(d: { callbackId: string } | { callbackInstanceId: string }) {
    await callbackRegistrationReconcileQueue.add(d);
  }

  async enqueueCallbacksV2Migration() {
    await callbackV2MigrationScanQueue.add({}, { id: 'callbacks-v2-migration' });
  }
}

export let callbackRegistrationService = Service.create(
  'callbackRegistrationService',
  () => new callbackRegistrationServiceImpl()
).build();
