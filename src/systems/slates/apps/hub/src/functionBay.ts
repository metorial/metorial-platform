import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createFunctionBayClient } from '@metorial-services/function-bay-client';
import { db } from './db';
import { env } from './env';
import { getId } from './id';

export let functionBay: ReturnType<typeof createFunctionBayClient> = createFunctionBayClient({
  endpoint: env.functionBay.FUNCTION_BAY_API_URL
});

let functionBayTenantPromise = new ProgrammablePromise<
  Awaited<ReturnType<typeof functionBay.tenant.upsert>>
>();
export let functionBayTenant = functionBayTenantPromise.promise;

export let functionBayProvider = await db.deploymentProvider.upsert({
  where: { identifier: 'function-bay' },
  create: {
    ...getId('deploymentProvider'),
    name: 'Function Bay',
    identifier: 'function-bay'
  },
  update: {}
});

(async () => {
  console.log('Ensuring function bay tenant exists...');

  while (true) {
    try {
      let tenant = await Promise.race([
        functionBay.tenant.upsert({
          name: 'Slates Hub Tenant',
          identifier: env.functionBay.FUNCTION_BAY_TENANT_IDENTIFIER
        }),
        delay(10000).then(() => {
          throw new Error('Function Bay tenant initialization timed out');
        })
      ]);

      functionBayTenantPromise.resolve(tenant);
      console.log(`Function Bay tenant ID: ${tenant.id}`);
      return;
    } catch (err) {
      console.log('Unable to create function bay tenant', err);
    }

    await delay(5000);
  }
})();
