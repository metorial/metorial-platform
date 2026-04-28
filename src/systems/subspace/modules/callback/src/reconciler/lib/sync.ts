import { db } from '@metorial-subspace/db';
import { slates } from '@metorial-subspace/provider-slates/src/client';
import { getTenantForSignal, signal } from '../../signal';
import {
  getTenantForSlatesCached,
  isCallbackSupported,
  loadCallback,
  loadCallbackInstance
} from './state';

export let detachRegistration = async (d: {
  callbackInstanceOid: bigint;
  slateTriggerReceiverId?: string | null;
  slatesTenantId: string;
}) => {
  try {
    if (d.slateTriggerReceiverId) {
      await slates.callbackRegistration.delete({
        tenantId: d.slatesTenantId,
        slateTriggerReceiverId: d.slateTriggerReceiverId
      });
    }
  } catch {}

  await db.callbackInstance.update({
    where: { oid: d.callbackInstanceOid },
    data: {
      registrationStatus: 'registered',
      slateTriggerReceiverId: null,
      activeRegistrationOid: null,
      lastSyncedAt: new Date(),
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null
    }
  });
};

export let upsertActiveRegistration = async (d: {
  callbackInstanceOid: bigint;
  slateTriggerReceiverId: string;
}) =>
  db.callbackInstance.update({
    where: { oid: d.callbackInstanceOid },
    data: {
      registrationStatus: 'registered',
      slateTriggerReceiverId: d.slateTriggerReceiverId,
      activeRegistrationOid: null,
      lastSyncedAt: new Date(),
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null
    }
  });

export let markRegistrationFailure = async (d: {
  callbackInstanceOid: bigint;
  message: string;
}) => {
  await db.callbackInstance.update({
    where: { oid: d.callbackInstanceOid },
    data: {
      registrationStatus: 'pending',
      lastSyncErrorCode: 'registration_failed',
      lastSyncErrorMessage: d.message,
      lastSyncedAt: new Date()
    }
  });
};

export let syncSignalCallback = async (d: { callbackId: string }) => {
  let callback = await loadCallback(d.callbackId);
  if (!callback) return;

  let signalTenant = await getTenantForSignal(callback.tenant);
  let activeDestinations = callback.callbackDestinationLinks
    .map(link => link.callbackDestination)
    .filter(destination => destination.status === 'active');
  let eventTypes = [
    ...new Set(callback.callbackProviderTriggers.flatMap(trigger => trigger.eventTypes))
  ];

  let signalCallback =
    callback.status === 'active' && isCallbackSupported(callback)
      ? await signal.callback.upsert({
          tenantId: signalTenant.id,
          callbackId: callback.id,
          name: callback.name,
          description: callback.description,
          eventTypes,
          destinations: activeDestinations.map(destination => ({
            externalId: destination.id,
            name: destination.name,
            description: destination.description,
            variant: {
              type: 'http_endpoint',
              url: destination.url,
              method: destination.method as 'POST' | 'PUT' | 'PATCH'
            }
          }))
        })
      : await signal.callback.archive({
          tenantId: signalTenant.id,
          callbackId: callback.id
        });

  if (signalCallback) {
    for (let link of signalCallback.destinations) {
      if (!link.destination.externalId) continue;
      await db.callbackDestination.updateMany({
        where: {
          tenantOid: callback.tenantOid,
          id: link.destination.externalId
        },
        data: {
          signalEventDestinationId: link.destination.id,
          lastSignalSyncedAt: new Date()
        }
      });
    }
  }

  await db.callback.update({
    where: { oid: callback.oid },
    data: { isCallbacksV2: true }
  });
};

export let syncCallbackInstance = async (d: { callbackInstanceId: string }) => {
  let callbackInstance = await loadCallbackInstance(d.callbackInstanceId);
  if (!callbackInstance) return;

  let callback = callbackInstance.callback;
  let providerTriggerInputs = callback.callbackProviderTriggers.map(trigger => ({
    triggerId: trigger.providerTrigger.specId,
    ...(callback.pollIntervalSecondsOverride !== null &&
    callback.pollIntervalSecondsOverride !== undefined
      ? { pollIntervalSeconds: callback.pollIntervalSecondsOverride }
      : {})
  }));
  let eventTypes = [
    ...new Set(callback.callbackProviderTriggers.flatMap(trigger => trigger.eventTypes))
  ];
  let slateTriggerReceiverId =
    callbackInstance.slateTriggerReceiverId ??
    callbackInstance.activeRegistration?.slateTriggerReceiverId;

  if (
    callbackInstance.status !== 'attached' ||
    !isCallbackSupported(callback) ||
    !providerTriggerInputs.length
  ) {
    if (slateTriggerReceiverId) {
      let slatesTenant = await getTenantForSlatesCached(callback.tenant);

      await detachRegistration({
        callbackInstanceOid: callbackInstance.oid,
        slateTriggerReceiverId,
        slatesTenantId: slatesTenant.id
      });
    } else {
      await db.callbackInstance.update({
        where: { oid: callbackInstance.oid },
        data: {
          registrationStatus: 'registered',
          slateTriggerReceiverId: null,
          activeRegistrationOid: null,
          lastSyncedAt: new Date(),
          lastSyncErrorCode: null,
          lastSyncErrorMessage: null
        }
      });
    }
    return;
  }

  try {
    await syncSignalCallback({ callbackId: callback.id });

    let slatesTenant = await getTenantForSlatesCached(callback.tenant);
    let slateInstanceId =
      callbackInstance.providerDeploymentConfigPair.providerConfigVersion.slateInstance?.id;

    if (!slateInstanceId) {
      throw new Error('missing_receiver_requirements');
    }

    let authConfigId =
      callbackInstance.providerDeploymentConfigPair.providerAuthConfigVersion?.slateAuthConfig
        ?.id ?? null;

    let receiver = await slates.callbackRegistration.upsert({
      tenantId: slatesTenant.id,
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id,
      slateTriggerReceiverId,
      slateInstanceId,
      authConfigId,
      triggers: providerTriggerInputs,
      eventTypes,
      name: `Callback ${callback.id}`
    });

    await upsertActiveRegistration({
      callbackInstanceOid: callbackInstance.oid,
      slateTriggerReceiverId: receiver.id
    });
  } catch (error) {
    let message = error instanceof Error ? error.message : 'callback_reconcile_failed';
    await markRegistrationFailure({
      callbackInstanceOid: callbackInstance.oid,
      message
    });
  }
};
