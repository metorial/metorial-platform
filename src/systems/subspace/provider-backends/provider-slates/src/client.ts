import { delay } from '@lowerdeck/delay';
import { createSlatesHubInternalClient } from '@metorial-services/slates-hub-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let slates = createSlatesHubInternalClient({
  endpoint: env.service.SLATES_HUB_URL
});

(async () => {
  while (true) {
    console.log('Attempting to connect to Slates...');
    try {
      await slates.tenant.upsert({
        identifier: 'subspace-test',
        name: 'Subspace TEST'
      });
      console.log('Successfully connected to Slates');
      return;
    } catch (error) {
      console.error('Failed to connect to Slates, retrying in 5 seconds...', error);
    }

    delay(5000);
  }
})();

export let getTenantForSlates = async (tenant: Tenant) => {
  if (!tenant.slateTenantId) {
    let slateTenant = await slates.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        slateTenantId: slateTenant.id,
        slateTenantIdentifier: slateTenant.identifier
      }
    });
  }

  return {
    id: tenant.slateTenantId!,
    identifier: tenant.slateTenantIdentifier!
  };
};
