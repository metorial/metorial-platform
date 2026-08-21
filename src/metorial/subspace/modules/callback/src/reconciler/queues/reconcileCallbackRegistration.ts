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
      let receiver = await slates.callbackRegistration.get({
        tenantId: tenant.id,
        callbackId: callbackInstance.callback.id,
        callbackInstanceId: callbackInstance.id,
        slateTriggerReceiverId: callbackInstance.slateTriggerReceiverId,
        expectedOwnerVersion: callbackInstance.registrationReceiverAuthorityVersion
      });
      await applyCallbackRegistrationMirror({
        callbackInstanceOid: callbackInstance.oid,
        receiver,
        expectedReceiverId: callbackInstance.slateTriggerReceiverId,
        expectedReceiverAuthorityVersion: callbackInstance.registrationReceiverAuthorityVersion
      });
    } catch {
      await markRegistrationFailure({ callbackInstanceOid: callbackInstance.oid });
      throw new QueueRetryError();
    }
  });
