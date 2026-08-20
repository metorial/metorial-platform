import { QueueRetryError } from '@lowerdeck/queue';
import { slates } from '@metorial-subspace/provider-slates/src/client';
import { applyCallbackRegistrationMirror, markRegistrationFailure } from '../lib/sync';
import { getTenantForSlatesCached, loadFreshCallbackInstance } from '../lib/state';
import { reconcileCallbackRegistrationQueue } from './definitions';

export let reconcileCallbackRegistrationQueueProcessor =
  reconcileCallbackRegistrationQueue.process(async data => {
    let callbackInstance = await loadFreshCallbackInstance(data.callbackInstanceId);
    if (!callbackInstance?.slateTriggerReceiverId) return;
    try {
      let tenant = await getTenantForSlatesCached(callbackInstance.callback.tenant);
      let receiver = await slates.slateTriggerReceiver.get({
        tenantId: tenant.id,
        slateTriggerReceiverId: callbackInstance.slateTriggerReceiverId
      });
      await applyCallbackRegistrationMirror({
        callbackInstanceOid: callbackInstance.oid,
        receiver,
        expectedReceiverId: callbackInstance.slateTriggerReceiverId
      });
    } catch (error) {
      await markRegistrationFailure({
        callbackInstanceOid: callbackInstance.oid,
        message: error instanceof Error ? error.message : 'registration_sync_failed'
      });
      throw new QueueRetryError();
    }
  });
