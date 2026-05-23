import { delay } from '@mtsrc/delay';
import { ProgrammablePromise } from '@mtsrc/programmable-promise';
import { createFunctionBayClient } from '@metorial-platform-systems/function-bay-client';
import type { Tenant } from '../prisma/generated/client';
import { db } from './db';
import { env } from './env';
import { getId } from './id';

export let functionBay: ReturnType<typeof createFunctionBayClient> = createFunctionBayClient({
  endpoint: env.functionBay.FUNCTION_BAY_API_URL
});

// export let fallbackFunctionBayTenant = await functionBay.tenant.upsert({
//   name: 'Shuttle Function Servers',
//   identifier: env.functionBay.FUNCTION_BAY_TENANT_IDENTIFIER
// });

export let functionBayProvider = await db.deploymentProvider.upsert({
  where: { identifier: 'function-bay' },
  create: {
    ...getId('deploymentProvider'),
    name: 'Function Bay',
    identifier: 'function-bay'
  },
  update: {}
});

let fallbackFunctionBayTenantPromise = new ProgrammablePromise<
  Awaited<ReturnType<typeof functionBay.tenant.upsert>>
>();
export let fallbackFunctionBayTenant = fallbackFunctionBayTenantPromise.promise;

(async () => {
  console.log('Ensuring function bay tenant exists...');

  while (true) {
    try {
      let tenant = await Promise.race([
        functionBay.tenant.upsert({
          name: 'Shuttle Function Servers',
          identifier: env.functionBay.FUNCTION_BAY_TENANT_IDENTIFIER
        }),
        delay(10000).then(() => {
          throw new Error('Function bay tenant initialization timed out');
        })
      ]);

      fallbackFunctionBayTenantPromise.resolve(tenant);
      console.log(`Function bay tenant ID: ${tenant.id}`);

      return;
    } catch (err) {
      console.log('Unable to create function bay tenant', err);
    }

    await delay(5000);
  }
})();

export let getTenantForFunctionBay = async (tenant: Tenant) => {
  if (!tenant.functionBayTenantId) {
    let newTenant = await functionBay.tenant.upsert({
      name: tenant.name,
      identifier: tenant.identifier
    });

    tenant = await db.tenant.update({
      where: { id: tenant.id },
      data: { functionBayTenantId: newTenant.id }
    });
  }

  return {
    id: tenant.functionBayTenantId!,
    identifier: tenant.identifier
  };
};
