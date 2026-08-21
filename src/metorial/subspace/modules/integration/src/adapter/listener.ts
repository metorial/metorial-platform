import { withTransaction } from '@metorial-subspace/db';
import type { IntegrationTransactionEvent } from '../listeners';
import { adapterInstanceLiveStatuses, adapterLiveStatuses } from './helpers';
import {
  removeAdapterInstance,
  removeAdapterIntegration,
  syncAdapterInstanceProviders,
  syncAdapterInstanceStatus,
  syncAdapterProviders
} from './primitives';

let loadScope = async (d: { tenantOid: bigint; environmentOid: bigint }) =>
  withTransaction(async db => {
    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: d.tenantOid } });
    let environment = await db.environment.findUniqueOrThrow({
      where: { oid: d.environmentOid }
    });
    return { tenant, environment };
  });

export let adapterCoordinationListener = {
  async onEvent(event: IntegrationTransactionEvent) {
    if (event.kind === 'integration.archived') {
      await withTransaction(async db => {
        let adapters = await db.adapterIntegration.findMany({
          where: {
            integrationOid: event.integration.oid,
            status: { in: [...adapterLiveStatuses] }
          }
        });
        if (adapters.length === 0) return;

        let scope = await loadScope(event.integration);
        for (let adapterIntegration of adapters) {
          await removeAdapterIntegration({
            ...scope,
            adapterIntegration,
            cause: 'integration'
          });
        }
      });
      return;
    }

    if (
      event.kind === 'integrationProvider.created' ||
      event.kind === 'integrationProvider.updated' ||
      event.kind === 'integrationProvider.archived'
    ) {
      await withTransaction(async db => {
        let adapters = await db.adapterIntegration.findMany({
          where: {
            integrationOid: event.integration.oid,
            status: { in: [...adapterLiveStatuses] }
          }
        });
        for (let adapterIntegration of adapters) {
          await syncAdapterProviders({ adapterIntegration });
        }
      });
      return;
    }

    if (event.kind === 'integrationInstance.archived') {
      await withTransaction(async db => {
        let adapterInstances = await db.adapterIntegrationInstance.findMany({
          where: {
            integrationInstanceOid: event.integrationInstance.oid,
            status: { in: [...adapterInstanceLiveStatuses] }
          }
        });
        if (adapterInstances.length === 0) return;

        let scope = await loadScope(event.integrationInstance);
        for (let adapterInstance of adapterInstances) {
          await removeAdapterInstance({
            ...scope,
            adapterInstance,
            cause: 'integration'
          });
        }
      });
      return;
    }

    if (
      event.kind === 'integrationInstance.created' ||
      event.kind === 'integrationInstance.updated'
    ) {
      await withTransaction(async db => {
        let adapterInstances = await db.adapterIntegrationInstance.findMany({
          where: {
            integrationInstanceOid: event.integrationInstance.oid,
            status: { in: [...adapterInstanceLiveStatuses] }
          }
        });
        for (let adapterInstance of adapterInstances) {
          await syncAdapterInstanceStatus({ adapterInstance });
        }
      });
      return;
    }

    if (
      event.kind === 'integrationInstanceProvider.set' ||
      event.kind === 'integrationInstanceProvider.archived'
    ) {
      await withTransaction(async db => {
        let adapterInstances = await db.adapterIntegrationInstance.findMany({
          where: {
            integrationInstanceOid: event.integrationInstance.oid,
            status: { in: [...adapterInstanceLiveStatuses] }
          }
        });
        for (let adapterInstance of adapterInstances) {
          await syncAdapterInstanceProviders({ adapterIntegrationInstance: adapterInstance });
        }
      });
    }
  }
};
