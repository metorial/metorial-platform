import { Service } from '@lowerdeck/service';
import { callbackRegistrationReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';

class callbackRegistrationServiceImpl {
  async enqueueReconcile(
    d: { callbackInstanceId: string } | { providerDeploymentConfigPairId: string }
  ) {
    await callbackRegistrationReconcileQueue.add(d);
  }
}

export let callbackRegistrationService = Service.create(
  'callbackRegistrationService',
  () => new callbackRegistrationServiceImpl()
).build();
