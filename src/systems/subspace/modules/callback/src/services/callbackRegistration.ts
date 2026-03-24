import { Service } from '@lowerdeck/service';
import { callbackReconcileQueue } from '../reconciler';

class callbackRegistrationServiceImpl {
  async enqueueReconcile(d: { callbackId: string } | { callbackInstanceId: string }) {
    await callbackReconcileQueue.add(d);
  }
}

export let callbackRegistrationService = Service.create(
  'callbackRegistrationService',
  () => new callbackRegistrationServiceImpl()
).build();
