import { withTransaction } from '@metorial-subspace/db';
import {
  registerIntegrationTransactionListener,
  type IntegrationTransactionEvent
} from '@metorial-subspace/module-integration';
import { projectChatFromAdapterIntegration } from './lib/project';

let projectAdaptersForIntegration = async (integrationOid: bigint) => {
  await withTransaction(async db => {
    let adapters = await db.adapterIntegration.findMany({
      where: { integrationOid, type: 'chat' }
    });
    for (let adapter of adapters) {
      await projectChatFromAdapterIntegration(adapter);
    }
  });
};

let projectAdaptersForInstance = async (integrationInstanceOid: bigint) => {
  await withTransaction(async db => {
    let adapterInstances = await db.adapterIntegrationInstance.findMany({
      where: { integrationInstanceOid },
      include: { adapterIntegration: true }
    });
    let seen = new Set<bigint>();
    for (let adapterInstance of adapterInstances) {
      if (adapterInstance.adapterIntegration.type !== 'chat') continue;
      if (seen.has(adapterInstance.adapterIntegrationOid)) continue;
      seen.add(adapterInstance.adapterIntegrationOid);
      await projectChatFromAdapterIntegration(adapterInstance.adapterIntegration);
    }
  });
};

export let chatIntegrationTransactionListener = {
  async onEvent(event: IntegrationTransactionEvent) {
    if (
      event.kind === 'integration.created' ||
      event.kind === 'integration.updated' ||
      event.kind === 'integration.archived' ||
      event.kind === 'integrationProvider.created' ||
      event.kind === 'integrationProvider.updated' ||
      event.kind === 'integrationProvider.archived'
    ) {
      await projectAdaptersForIntegration(event.integration.oid);
      return;
    }

    if (
      event.kind === 'integrationInstance.created' ||
      event.kind === 'integrationInstance.updated' ||
      event.kind === 'integrationInstance.archived' ||
      event.kind === 'integrationInstanceProvider.set' ||
      event.kind === 'integrationInstanceProvider.archived'
    ) {
      await projectAdaptersForInstance(event.integrationInstance.oid);
    }
  }
};

let registered = false;

export let registerChatIntegrationListener = () => {
  if (registered) return;
  registered = true;
  registerIntegrationTransactionListener(chatIntegrationTransactionListener);
};

registerChatIntegrationListener();
