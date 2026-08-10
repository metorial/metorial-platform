import { isServiceError } from '@lowerdeck/error';
import { db } from '@metorial-subspace/db';
import { slates } from '@metorial-subspace/provider-slates/src/client';
import { getTenantForSignal, signal } from '../../signal';
import {
  getTenantForSlatesCached,
  isCallbackSupported,
  loadCallback,
  loadFreshCallback,
  loadFreshCallbackInstance,
  loadCallbackInstance,
  TRIGGER_PAGE_SIZE
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

let markCallbackV2IfReady = async (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) => {
  if (callback.isCallbacksV2) return;

  if (!isCallbackSupported(callback) || callback.callbackProviderTriggers.length === 0) {
    await db.callback.update({
      where: { oid: callback.oid },
      data: { isCallbacksV2: true }
    });
    return;
  }

  let attachedInstances = await db.callbackInstance.findMany({
    where: {
      callbackOid: callback.oid,
      status: 'attached'
    },
    select: {
      slateTriggerReceiverId: true,
      activeRegistration: {
        select: {
          slateTriggerReceiverId: true
        }
      }
    }
  });

  if (
    attachedInstances.length === 0 ||
    attachedInstances.some(
      instance =>
        !!(
          instance.slateTriggerReceiverId ??
          instance.activeRegistration?.slateTriggerReceiverId
        )
    )
  ) {
    await db.callback.update({
      where: { oid: callback.oid },
      data: { isCallbacksV2: true }
    });
  }
};

let syncLoadedSignalCallback = async (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) => {
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
      : await (async () => {
          try {
            return await signal.callback.archive({
              tenantId: signalTenant.id,
              callbackId: callback.id
            });
          } catch (error) {
            if (isServiceError(error) && error.data.code === 'not_found') {
              return null;
            }

            throw error;
          }
        })();

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

  await markCallbackV2IfReady(callback);
};

export let syncSignalCallback = async (d: { callbackId: string; fresh?: boolean }) => {
  let callback = d.fresh
    ? await loadFreshCallback(d.callbackId)
    : await loadCallback(d.callbackId);
  if (!callback) return;

  await syncLoadedSignalCallback(callback);
};

export let syncCallback = async (d: {
  callbackId: string;
  fresh?: boolean;
  throwOnError?: boolean;
}) => {
  await syncSignalCallback({ callbackId: d.callbackId, fresh: d.fresh });

  let cursor: string | undefined;
  while (true) {
    let rows = await db.callbackInstance.findMany({
      where: {
        callback: {
          id: d.callbackId
        },
        status: 'attached',
        id: cursor ? { gt: cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) return;

    for (let row of rows) {
      await syncCallbackInstance({
        callbackInstanceId: row.id,
        fresh: d.fresh,
        skipSignalSync: true,
        throwOnError: d.throwOnError
      });
    }

    if (rows.length < TRIGGER_PAGE_SIZE) return;
    cursor = rows[rows.length - 1]!.id;
  }
};

export let syncCallbackInstance = async (d: {
  callbackInstanceId: string;
  fresh?: boolean;
  skipSignalSync?: boolean;
  throwOnError?: boolean;
}) => {
  let callbackInstance = d.fresh
    ? await loadFreshCallbackInstance(d.callbackInstanceId)
    : await loadCallbackInstance(d.callbackInstanceId);
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

    await markCallbackV2IfReady(callback);
    return;
  }

  try {
    if (!d.skipSignalSync) {
      await syncSignalCallback({ callbackId: callback.id, fresh: d.fresh });
    }

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
    await markCallbackV2IfReady(callback);
  } catch (error) {
    let message = error instanceof Error ? error.message : 'callback_reconcile_failed';
    await markRegistrationFailure({
      callbackInstanceOid: callbackInstance.oid,
      message
    });

    if (d.throwOnError) {
      throw error;
    }
  }
};
