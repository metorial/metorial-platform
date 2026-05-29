import { delay } from '@lowerdeck/delay';
import { createFunctionBayClient } from '@metorial-platform-systems/function-bay-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let functionBay: ReturnType<typeof createFunctionBayClient> = createFunctionBayClient({
  endpoint: env.functionBay.FUNCTION_BAY_URL
});

(async () => {
  while (true) {
    console.log('Attempting to connect to FunctionBay...');
    try {
      await functionBay.tenant.upsert({
        identifier: 'subspace-test',
        name: 'Subspace TEST'
      });
      console.log('Successfully connected to FunctionBay');
      return;
    } catch (error) {
      console.error('Failed to connect to FunctionBay, retrying in 5 seconds...', error);
    }

    await delay(5000);
  }
})();

export let getTenantForFunctionBay = async (tenant: Tenant) => {
  if (!tenant.functionBayTenantId) {
    let functionBayTenant = await functionBay.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        functionBayTenantId: functionBayTenant.id,
        functionBayTenantIdentifier: functionBayTenant.identifier
      }
    });
  }

  return {
    id: tenant.functionBayTenantId!,
    identifier: tenant.functionBayTenantIdentifier!
  };
};
