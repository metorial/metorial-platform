import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '../client';

class containerRepositoryServiceImpl {
  async getContainerRepositoryById(d: { containerRepositoryId: string; tenant: Tenant }) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRepository.get({
      tenantId: tenant.id,
      repositoryId: d.containerRepositoryId
    });
  }

  async listContainerRepositories(d: { tenant: Tenant } & PaginatorInput) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRepository.list({
      ...(d as any),
      tenant: undefined,
      tenantId: tenant.id
    });
  }
}

export let containerRepositoryService = Service.create(
  'containerRepository',
  () => new containerRepositoryServiceImpl()
).build();

export type ShuttleContainerRepository = Awaited<
  ReturnType<typeof shuttle.containerRepository.get>
>;
