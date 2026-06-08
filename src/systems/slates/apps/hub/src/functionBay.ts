import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createFunctionBayClient } from '@metorial-platform-systems/function-bay-client';
import type { Tenant } from '../prisma/generated/client';
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
          identifier: env.functionBay.FUNCTION_BAY_TENANT_IDENTIFIER,
          isServiceDefault: true
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

export let getFunctionBayTenantForTenant = async (
  tenant: Pick<
    Tenant,
    'oid' | 'identifier' | 'name' | 'functionBayTenantId' | 'functionBayTenantIdentifier'
  >
) => {
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
