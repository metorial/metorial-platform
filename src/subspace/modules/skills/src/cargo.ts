import { createCargoClient } from '@metorial-platform-systems/cargo-client';
import type { Environment, Tenant, TenantActor } from '@metorial-subspace/db';
import { env } from './env';

export let cargo = createCargoClient({
  endpoint: env.cargo.CARGO_API_URL
});

export let ensureCargoTenant = (tenant: Tenant) =>
  cargo.tenant.upsert({
    name: tenant.name,
    identifier: tenant.identifier
  });

export let ensureCargoEnvironment = (
  tenant: Awaited<ReturnType<typeof ensureCargoTenant>>,
  environment: Environment
) =>
  cargo.environment.upsert({
    tenantId: tenant.id,
    type: environment.type,
    name: environment.name,
    identifier: environment.identifier
  });

export let ensureCargoScope = async (d: { tenant: Tenant; environment: Environment }) => {
  let tenant = await ensureCargoTenant(d.tenant);
  let environment = await ensureCargoEnvironment(tenant, d.environment);

  return {
    tenantId: tenant.id,
    environmentId: environment.id
  };
};

export let ensureCargoActor = (
  tenant:
    | Awaited<ReturnType<typeof ensureCargoTenant>>
    | Awaited<ReturnType<typeof ensureCargoScope>>,
  actor: TenantActor
) => {
  let tenantId = 'tenantId' in tenant ? tenant.tenantId : tenant.id;

  return cargo.actor.upsert({
    tenantId,
    name: actor.name,
    identifier: actor.identifier,
    consumerId: actor.consumerId ?? undefined,
    organizationActorId: actor.organizationActorId ?? undefined
  });
};
