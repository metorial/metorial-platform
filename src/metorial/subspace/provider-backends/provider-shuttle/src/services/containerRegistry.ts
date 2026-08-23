import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '../client';

class containerRegistryServiceImpl {
  async getContainerRegistryById(d: { containerRegistryId: string; tenant: Tenant }) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRegistry.get({
      tenantId: tenant.id,
      registryId: d.containerRegistryId
    });
  }

  async listContainerRegistries(d: { tenant: Tenant } & PaginatorInput) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRegistry.list({
      ...(d as any),
      tenant: undefined,
      tenantId: tenant.id
    });
  }
}

export let containerRegistryService = Service.create(
  'containerRegistry',
  () => new containerRegistryServiceImpl()
).build();

export type ShuttleContainerRegistry = Awaited<
  ReturnType<typeof shuttle.containerRegistry.get>
>;
