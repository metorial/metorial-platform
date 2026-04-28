import { db } from '@metorial-subspace/db';
import { callbackRegistrationReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import { TRIGGER_PAGE_SIZE } from '../lib/state';
import { syncCallbackInstance, syncSignalCallback } from '../lib/sync';
import {
  callbackReconcileInstanceQueue,
  callbackReconcileInstancesPageQueue,
  callbackV2MigrationCallbackQueue,
  callbackV2MigrationScanQueue
} from './definitions';

let CALLBACK_MIGRATION_PAGE_SIZE = 100;

export let callbackReconcileQueueProcessor = callbackRegistrationReconcileQueue.process(
  async data => {
    if (data.callbackInstanceId) {
      await callbackReconcileInstanceQueue.add({
        callbackInstanceId: data.callbackInstanceId
      });
      return;
    }

    if (data.callbackId) {
      await syncSignalCallback({ callbackId: data.callbackId });
      await callbackReconcileInstancesPageQueue.add({ callbackId: data.callbackId });
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
  }
);

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

export let callbackV2MigrationScanQueueProcessor = callbackV2MigrationScanQueue.process(
  async data => {
    let callbacks = await db.callback.findMany({
      where: {
        isCallbacksV2: false,
        status: { not: 'deleted' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: CALLBACK_MIGRATION_PAGE_SIZE,
      select: { id: true }
    });
    if (!callbacks.length) return;

    await callbackV2MigrationCallbackQueue.addManyWithOps(
      callbacks.map(callback => ({
        data: { callbackId: callback.id },
        opts: { id: callback.id }
      }))
    );

    if (callbacks.length === CALLBACK_MIGRATION_PAGE_SIZE) {
      await callbackV2MigrationScanQueue.add({
        cursor: callbacks[callbacks.length - 1]!.id
      });
    }
  }
);

export let callbackV2MigrationCallbackQueueProcessor =
  callbackV2MigrationCallbackQueue.process(async data => {
    await syncSignalCallback({ callbackId: data.callbackId });
    await callbackReconcileInstancesPageQueue.add({ callbackId: data.callbackId });
  });

await callbackV2MigrationScanQueue.add({}, { id: 'callbacks-v2-migration' });
