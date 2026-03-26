import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '../client';

class containerVersionServiceImpl {
  async getContainerVersionById(d: { containerVersionId: string; tenant: Tenant }) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRepositoryVersion.get({
      tenantId: tenant.id,
      repositoryVersionId: d.containerVersionId
    });
  }

  async listContainerVersion(d: { tenant: Tenant } & PaginatorInput) {
    let tenant = await getTenantForShuttle(d.tenant);
    return shuttle.containerRepositoryVersion.list({
      ...(d as any),
      tenant: undefined,
      tenantId: tenant.id
    });
  }
}

export let containerVersionService = Service.create(
  'containerVersion',
  () => new containerVersionServiceImpl()
).build();

export type ShuttleContainerVersion = Awaited<
  ReturnType<typeof shuttle.containerRepositoryVersion.get>
>;
