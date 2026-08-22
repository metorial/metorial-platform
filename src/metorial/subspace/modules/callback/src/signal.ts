import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { createSignalClient } from '@metorial-platform-systems/signal-client';
import type { Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let signal = createSignalClient({
  endpoint: env.service.SIGNAL_API_URL
});

let getSignalTenantCached = createLocallyCachedFunction({
  getHash: (tenant: Tenant) => tenant.identifier,
  ttlSeconds: 60,
  provider: async (tenant: Tenant) =>
    await signal.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    })
});

export let getTenantForSignal = async (tenant: Tenant) => await getSignalTenantCached(tenant);
