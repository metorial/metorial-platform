import { Service } from '@lowerdeck/service';
import { callbackRegistrationReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import {
  detachRegistration,
  syncCallback,
  syncCallbackInstance
} from '../reconciler/lib/sync';

class callbackRegistrationServiceImpl {
  async enqueueReconcile(
    d: { callbackInstanceId: string } | { providerDeploymentConfigPairId: string }
  ) {
    await callbackRegistrationReconcileQueue.add(d);
  }

  async syncCallback(d: { callbackId: string }) {
    await syncCallback({
      callbackId: d.callbackId,
      fresh: true,
      throwOnError: true
    });
  }

  async syncCallbackInstance(d: { callbackInstanceId: string }) {
    await syncCallbackInstance({
      callbackInstanceId: d.callbackInstanceId,
      fresh: true,
      throwOnError: true
    });
  }

  async detachRegistration(d: Parameters<typeof detachRegistration>[0]) {
    await detachRegistration(d);
  }
}

export let callbackRegistrationService = Service.create(
  'callbackRegistrationService',
  () => new callbackRegistrationServiceImpl()
).build();
