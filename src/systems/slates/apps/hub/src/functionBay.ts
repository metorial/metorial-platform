import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { db } from './db';
import { env } from './env';
import { getId } from './id';

import type { createFunctionBayClient as createFunctionBayClientFn } from '@metorial-platform-systems/function-bay-client';

type FunctionBayClient = ReturnType<typeof createFunctionBayClientFn>;
type FunctionBayTenant = Awaited<ReturnType<FunctionBayClient['tenant']['upsert']>>;

let isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

let unexpectedFunctionBayUsage = async (method: string): Promise<never> => {
  throw new Error(
    `Unexpected functionBay.${method} call in tests. Mock '../../../functionBay' in tests that use Function Bay.`
  );
};

let createTestFunctionBayClient = () =>
  ({
    tenant: {
      upsert: async () => ({ id: 'fb-tenant' })
    },
    function: {
      upsert: async () => unexpectedFunctionBayUsage('function.upsert'),
      invoke: async () => unexpectedFunctionBayUsage('function.invoke')
    },
    functionDeployment: {
      create: async () => unexpectedFunctionBayUsage('functionDeployment.create'),
      get: async () => unexpectedFunctionBayUsage('functionDeployment.get'),
      getOutput: async () => unexpectedFunctionBayUsage('functionDeployment.getOutput')
    },
    functionInvocation: {
      get: async () => unexpectedFunctionBayUsage('functionInvocation.get')
    }
  }) as FunctionBayClient;

export let functionBay: FunctionBayClient = isTestEnv
  ? createTestFunctionBayClient()
  : (await import('@metorial-platform-systems/function-bay-client')).createFunctionBayClient({
      endpoint: env.functionBay.FUNCTION_BAY_API_URL
    });

let functionBayTenantPromise = new ProgrammablePromise<FunctionBayTenant>();
export let functionBayTenant = isTestEnv
  ? Promise.resolve({ id: 'fb-tenant' } as FunctionBayTenant)
  : functionBayTenantPromise.promise;

export let functionBayProvider = isTestEnv
  ? ({ oid: BigInt(1) } as Awaited<ReturnType<typeof db.deploymentProvider.upsert>>)
  : await db.deploymentProvider.upsert({
      where: { identifier: 'function-bay' },
      create: {
        ...getId('deploymentProvider'),
        name: 'Function Bay',
        identifier: 'function-bay'
      },
      update: {}
    });

if (!isTestEnv) {
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
}
