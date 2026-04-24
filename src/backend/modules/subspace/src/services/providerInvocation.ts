import { Service } from '@lowerdeck/service';
import type { Instance } from '@metorial/db';
import { getTenantForSubspace, subspace } from '../subspace';

class subspaceProviderInvocationServiceImpl {
  async get(d: { instance: Instance; providerInvocationId: string }) {
    let { tenant, environmentId } = await getTenantForSubspace(d.instance);

    return await subspace.providerInvocation.get({
      tenantId: tenant.id,
      environmentId,
      providerInvocationId: d.providerInvocationId
    });
  }

  async list(d: {
    instance: Instance;
    providerRunIds?: string[];
    sessionMessageIds?: string[];
    authConfigEventIds?: string[];
  }) {
    let { tenant, environmentId } = await getTenantForSubspace(d.instance);

    return await subspace.providerInvocation.list({
      tenantId: tenant.id,
      environmentId,
      providerRunIds: d.providerRunIds,
      sessionMessageIds: d.sessionMessageIds,
      authConfigEventIds: d.authConfigEventIds
    });
  }
}

export let subspaceProviderInvocationService = Service.create(
  'subspaceProviderInvocationService',
  () => new subspaceProviderInvocationServiceImpl()
).build();

export type SubspaceProviderInvocation = Awaited<
  ReturnType<typeof subspace.providerInvocation.get>
>;
