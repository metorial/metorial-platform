import { db } from '@metorial-subspace/db';
import { callbackRegistrationReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import { syncCallbackInstance } from '../lib/sync';
import { callbackReconcileInstanceQueue } from './definitions';

export let callbackReconcileQueueProcessor = callbackRegistrationReconcileQueue.process(
  async data => {
    if (data.callbackInstanceId) {
      await callbackReconcileInstanceQueue.add({
        callbackInstanceId: data.callbackInstanceId
      });
      return;
    }

    if (!data.providerDeploymentConfigPairId) return;
    let callbackInstances = await db.callbackInstance.findMany({
      where: {
        providerDeploymentConfigPair: { id: data.providerDeploymentConfigPairId },
        callback: { status: 'active' },
        status: 'attached'
      },
      select: { id: true }
    });
    await callbackReconcileInstanceQueue.addManyWithOps(
      callbackInstances.map(callbackInstance => ({
        data: { callbackInstanceId: callbackInstance.id },
        opts: { id: callbackInstance.id }
      }))
    );
  }
);

export let callbackReconcileInstanceQueueProcessor = callbackReconcileInstanceQueue.process(
  async data => {
    await syncCallbackInstance(data);
  }
);
