import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { createSignalClient } from '@metorial-platform-systems/signal-client';
import type { Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let signal = createSignalClient({
  endpoint: env.service.SIGNAL_API_URL
});

export let createInternalSignalClientOptions = (d: {
  endpoint: string;
  serviceCredential: string | undefined;
}) => {
  if (!d.serviceCredential) {
    throw new Error('Signal service credential is required.');
  }

  return {
    endpoint: d.endpoint,
    headers: {
      'x-metorial-signal-service-credential': d.serviceCredential
    }
  };
};

let internalSignal: ReturnType<typeof createSignalClient> | null = null;
export let getInternalSignal = () => {
  if (!internalSignal) {
    internalSignal = createSignalClient(
      createInternalSignalClientOptions({
        endpoint: env.service.SIGNAL_API_URL,
        serviceCredential: env.service.SIGNAL_SERVICE_CREDENTIAL
      })
    );
  }
  return internalSignal;
};

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
