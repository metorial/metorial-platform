import { db, getId } from '@metorial-subspace/db';
import { slates } from '@metorial-subspace/provider-slates/src/client';
import {
  getActiveDestinationIds,
  getTenantForSlatesCached,
  isCallbackSupported,
  loadCallbackInstance
} from './state';

export let markCallbackInstancePending = async (d: {
  callbackInstanceOid: bigint;
  registrationOid?: bigint;
}) =>
  db.$transaction(async db => {
    if (d.registrationOid) {
      await db.callbackReceiverRegistration.updateMany({
        where: { oid: d.registrationOid },
        data: {
          status: 'detached',
          lastSyncedAt: new Date()
        }
      });
    }

    await db.callbackInstance.update({
      where: { oid: d.callbackInstanceOid },
      data: {
        registrationStatus: 'pending',
        activeRegistrationOid: null
      }
    });
  });

export let detachRegistration = async (d: {
  callbackInstanceOid: bigint;
  registrationOid: bigint;
  slateTriggerReceiverId: string;
  slatesTenantId: string;
}) => {
  try {
    if (d.slateTriggerReceiverId) {
      await slates.slateTriggerReceiver.delete({
        tenantId: d.slatesTenantId,
        slateTriggerReceiverId: d.slateTriggerReceiverId
      });
    }
  } catch {}

  await markCallbackInstancePending({
    callbackInstanceOid: d.callbackInstanceOid,
    registrationOid: d.registrationOid
  });
};

export let detachOrphanRegistration = async (d: {
  registrationOid: bigint;
  slateTriggerReceiverId: string;
  slatesTenantId: string;
}) => {
  try {
    if (d.slateTriggerReceiverId) {
      await slates.slateTriggerReceiver.delete({
        tenantId: d.slatesTenantId,
        slateTriggerReceiverId: d.slateTriggerReceiverId
      });
    }
  } catch {}

  await db.callbackReceiverRegistration.updateMany({
    where: { oid: d.registrationOid },
    data: {
      status: 'detached',
      lastSyncedAt: new Date()
    }
  });
};

export let upsertActiveRegistration = async (d: {
  callbackInstanceOid: bigint;
  callbackOid: bigint;
  providerDeploymentConfigPairOid: bigint;
  activeRegistrationOid?: bigint;
  slateTriggerReceiverId: string;
}) =>
  db.$transaction(async db => {
    let registrationOid = d.activeRegistrationOid;

    if (registrationOid) {
      await db.callbackReceiverRegistration.update({
        where: { oid: registrationOid },
        data: {
          slateTriggerReceiverId: d.slateTriggerReceiverId,
          status: 'active',
          lastErrorCode: null,
          lastErrorMessage: null,
          lastSyncedAt: new Date()
        }
      });
    } else {
      let registration = await db.callbackReceiverRegistration.create({
        data: {
          ...getId('callbackReceiverRegistration'),
          callbackOid: d.callbackOid,
          providerDeploymentConfigPairOid: d.providerDeploymentConfigPairOid,
          callbackInstanceOid: d.callbackInstanceOid,
          slateTriggerReceiverId: d.slateTriggerReceiverId,
          status: 'active',
          lastErrorCode: null,
          lastErrorMessage: null,
          lastSyncedAt: new Date()
        },
        select: { oid: true }
      });
      registrationOid = registration.oid;
    }

    await db.callbackInstance.update({
      where: { oid: d.callbackInstanceOid },
      data: {
        registrationStatus: 'registered',
        activeRegistrationOid: registrationOid
      }
    });
  });

export let markRegistrationFailure = async (d: {
  callbackInstanceOid: bigint;
  activeRegistrationOid?: bigint;
  message: string;
}) => {
  if (d.activeRegistrationOid) {
    await db.callbackReceiverRegistration.update({
      where: { oid: d.activeRegistrationOid },
      data: {
        lastErrorCode: 'callback_reconcile_failed',
        lastErrorMessage: d.message,
        lastSyncedAt: new Date()
      }
    });
    return;
  }

  await db.callbackInstance.update({
    where: { oid: d.callbackInstanceOid },
    data: {
      registrationStatus: 'pending'
    }
  });
};

export let syncCallbackInstance = async (d: { callbackInstanceId: string }) => {
  let callbackInstance = await loadCallbackInstance(d.callbackInstanceId);
  if (!callbackInstance) return;

  let callback = callbackInstance.callback;
  let destinationIds = getActiveDestinationIds(callback);
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
  let activeRegistration = callbackInstance.activeRegistration;

  if (
    callbackInstance.status !== 'attached' ||
    !isCallbackSupported(callback) ||
    !destinationIds.length ||
    !providerTriggerInputs.length
  ) {
    if (activeRegistration) {
      let slatesTenant = await getTenantForSlatesCached(callback.tenant);
      await detachRegistration({
        callbackInstanceOid: callbackInstance.oid,
        registrationOid: activeRegistration.oid,
        slateTriggerReceiverId: activeRegistration.slateTriggerReceiverId,
        slatesTenantId: slatesTenant.id
      });
    } else if (callbackInstance.registrationStatus !== 'pending') {
      await db.callbackInstance.update({
        where: { oid: callbackInstance.oid },
        data: {
          registrationStatus: 'pending',
          activeRegistrationOid: null
        }
      });
    }
    return;
  }

  try {
    let slatesTenant = await getTenantForSlatesCached(callback.tenant);
    let slateInstanceId =
      callbackInstance.providerDeploymentConfigPair.providerConfigVersion.slateInstance?.id;
    if (!slateInstanceId) {
      throw new Error('missing_receiver_requirements');
    }

    let authConfigId =
      callbackInstance.providerDeploymentConfigPair.providerAuthConfigVersion?.slateAuthConfig
        ?.id ?? null;

    let receiver = activeRegistration
      ? await slates.slateTriggerReceiver.update({
          tenantId: slatesTenant.id,
          slateTriggerReceiverId: activeRegistration.slateTriggerReceiverId,
          authConfigId,
          destinations: destinationIds,
          triggers: providerTriggerInputs,
          eventTypes
        })
      : await slates.slateTriggerReceiver.create({
          tenantId: slatesTenant.id,
          slateInstanceId,
          authConfigId: authConfigId ?? undefined,
          destinations: destinationIds,
          triggers: providerTriggerInputs,
          eventTypes,
          name: `Callback ${callback.id}`
        });

    await upsertActiveRegistration({
      callbackInstanceOid: callbackInstance.oid,
      callbackOid: callback.oid,
      providerDeploymentConfigPairOid: callbackInstance.providerDeploymentConfigPairOid,
      activeRegistrationOid: activeRegistration?.oid,
      slateTriggerReceiverId: receiver.id
    });
  } catch (error) {
    let message = error instanceof Error ? error.message : 'callback_reconcile_failed';
    await markRegistrationFailure({
      callbackInstanceOid: callbackInstance.oid,
      activeRegistrationOid: activeRegistration?.oid,
      message
    });
  }
};
