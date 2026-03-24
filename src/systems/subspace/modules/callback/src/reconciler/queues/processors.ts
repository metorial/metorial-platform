import { db } from '@metorial-subspace/db';
import {
  callbackInclude,
  getActiveDestinationIds,
  getTenantForSlatesCached,
  isCallbackSupported,
  REGISTRATION_PAGE_SIZE,
  TRIGGER_PAGE_SIZE
} from '../lib/state';
import {
  detachOrphanRegistration,
  detachRegistration,
  syncCallbackInstance
} from '../lib/sync';
import {
  callbackReconcileQueue,
  callbackReconcileRegistrationAuditQueue,
  callbackReconcileRegistrationsPageQueue,
  callbackReconcileInstanceQueue,
  callbackReconcileInstancesPageQueue
} from './definitions';

export let callbackReconcileQueueProcessor = callbackReconcileQueue.process(async data => {
  if (data.callbackInstanceId) {
    await callbackReconcileInstanceQueue.add({
      callbackInstanceId: data.callbackInstanceId
    });
    return;
  }

  if (data.callbackId) {
    await callbackReconcileInstancesPageQueue.add({ callbackId: data.callbackId });
    await callbackReconcileRegistrationsPageQueue.add({ callbackId: data.callbackId });
    return;
  }

  if (data.providerDeploymentConfigPairId) {
    let callbackInstances = await db.callbackInstance.findMany({
      where: {
        providerDeploymentConfigPair: { id: data.providerDeploymentConfigPairId },
        callback: {
          status: 'active'
        },
        status: 'attached'
      },
      select: { id: true }
    });
    if (!callbackInstances.length) return;

    await callbackReconcileInstanceQueue.addManyWithOps(
      callbackInstances.map(callbackInstance => ({
        data: { callbackInstanceId: callbackInstance.id },
        opts: { id: callbackInstance.id }
      }))
    );
  }
});

export let callbackReconcileInstanceQueueProcessor = callbackReconcileInstanceQueue.process(
  async data => {
    await syncCallbackInstance(data);
  }
);

export let callbackReconcileInstancesPageQueueProcessor =
  callbackReconcileInstancesPageQueue.process(async data => {
    let rows = await db.callbackInstance.findMany({
      where: {
        callback: {
          id: data.callbackId
        },
        status: 'attached',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) return;

    await callbackReconcileInstanceQueue.addManyWithOps(
      rows.map(row => ({
        data: { callbackInstanceId: row.id },
        opts: { id: row.id }
      }))
    );

    if (rows.length === TRIGGER_PAGE_SIZE) {
      await callbackReconcileInstancesPageQueue.add({
        callbackId: data.callbackId,
        cursor: rows[rows.length - 1]!.id
      });
    }
  });

export let callbackReconcileRegistrationsPageQueueProcessor =
  callbackReconcileRegistrationsPageQueue.process(async data => {
    let rows = await db.callbackReceiverRegistration.findMany({
      where: {
        callback: {
          id: data.callbackId
        },
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: REGISTRATION_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) return;

    await callbackReconcileRegistrationAuditQueue.addManyWithOps(
      rows.map(row => ({
        data: { registrationId: row.id },
        opts: { id: row.id }
      }))
    );

    if (rows.length === REGISTRATION_PAGE_SIZE) {
      await callbackReconcileRegistrationsPageQueue.add({
        callbackId: data.callbackId,
        cursor: rows[rows.length - 1]!.id
      });
    }
  });

export let callbackReconcileRegistrationAuditQueueProcessor =
  callbackReconcileRegistrationAuditQueue.process(async data => {
    let registration = await db.callbackReceiverRegistration.findFirst({
      where: { id: data.registrationId },
      include: {
        callback: {
          include: callbackInclude
        },
        callbackInstance: {
          select: {
            oid: true,
            activeRegistrationOid: true
          }
        }
      }
    });
    if (!registration) return;

    let slatesTenant = await getTenantForSlatesCached(registration.callback.tenant);

    if (registration.callbackInstance.activeRegistrationOid !== registration.oid) {
      await detachOrphanRegistration({
        registrationOid: registration.oid,
        slateTriggerReceiverId: registration.slateTriggerReceiverId,
        slatesTenantId: slatesTenant.id
      });
      return;
    }

    let callback = registration.callback;
    let destinationIds = getActiveDestinationIds(callback);
    if (
      !isCallbackSupported(callback) ||
      !destinationIds.length ||
      callback.callbackProviderTriggers.length === 0
    ) {
      await detachRegistration({
        callbackInstanceOid: registration.callbackInstance.oid,
        registrationOid: registration.oid,
        slateTriggerReceiverId: registration.slateTriggerReceiverId,
        slatesTenantId: slatesTenant.id
      });
    }
  });
