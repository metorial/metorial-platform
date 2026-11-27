import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '../client';

class containerTagServiceImpl {
  async getContainerTagById(d: { containerTagId: string; tenant: Tenant }) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRepositoryTag.get({
      tenantId: tenant.id,
      repositoryTagId: d.containerTagId
    });
  }

  async listContainerTag(d: { tenant: Tenant } & PaginatorInput) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRepositoryTag.list({
      ...(d as any),
      tenant: undefined,
      tenantId: tenant.id
    });
  }
}

export let containerTagService = Service.create(
  'containerTag',
  () => new containerTagServiceImpl()
).build();

export type ShuttleContainerTag = Awaited<
  ReturnType<typeof shuttle.containerRepositoryTag.get>
>;
