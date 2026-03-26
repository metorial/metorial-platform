import { delay } from '@lowerdeck/delay';
import {
  createLiveConnectionClient,
  createShuttleClient
} from '@metorial-services/shuttle-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';
import { withShuttleRetry } from './shuttleRetry';

export let shuttle = createShuttleClient({
  endpoint: env.service.SHUTTLE_URL
});

export let shuttleLiveClient = await createLiveConnectionClient({
  endpoint: env.service.SHUTTLE_LIVE_URL
});

(async () => {
  while (true) {
    console.log('Attempting to connect to Shuttle...');
    try {
      await shuttle.tenant.upsert({
        identifier: 'subspace-test',
        name: 'Subspace TEST'
      });
      console.log('Successfully connected to Shuttle');
      return;
    } catch (error) {
      console.error('Failed to connect to Shuttle, retrying in 5 seconds...', error);
    }

    delay(5000);
  }
})();

export let shuttleDefaultReaderTenant = await withShuttleRetry(
  () =>
    shuttle.tenant.upsert({
      name: 'Subspace Default Reader',
      identifier: 'subspace-default-reader'
    }),
  {
    endpoint: env.service.SHUTTLE_URL
  }
);

export let getTenantForShuttle = async (tenant: Tenant) => {
  if (!tenant.shuttleTenantId) {
    let shuttleTenant = await shuttle.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        shuttleTenantId: shuttleTenant.id,
        shuttleTenantIdentifier: shuttleTenant.identifier
      }
    });
  }

  return {
    id: tenant.shuttleTenantId!,
    identifier: tenant.shuttleTenantIdentifier!
  };
};

export type ContainerRegistry = Awaited<ReturnType<typeof shuttle.containerRegistry.get>>;
export type ContainerRepository = Awaited<ReturnType<typeof shuttle.containerRepository.get>>;
export type NetworkingRuleset = Awaited<ReturnType<typeof shuttle.networkingRuleset.get>>;
