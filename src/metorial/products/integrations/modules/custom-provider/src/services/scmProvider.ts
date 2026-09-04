import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import {
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  getTenantForOrigin,
  normalizeScmProvider,
  origin,
  type OriginList,
  type ScmProvider
} from '../origin';

type GetScmProviderByIdParams = {
  scmProviderId: string;
};

type ListScmProvidersParams = PaginatorInput;

class scmProviderServiceImpl {
  async getScmProviderById(d: MetorialFacing<GetScmProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getScmProviderByIdInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getScmProviderByIdInternal(
    d: { tenant: Tenant } & GetScmProviderByIdParams
  ): Promise<ScmProvider> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmProvider(
      await origin.scmBackend.get({
        tenantId: tenant.id,
        backendId: d.scmProviderId
      })
    );
  }

  async listScmProviders(d: MetorialFacing<ListScmProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listScmProvidersInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async listScmProvidersInternal(
    d: { tenant: Tenant } & PaginatorInput
  ): Promise<OriginList<ScmProvider>> {
    let tenant = await getTenantForOrigin(d.tenant);
    let list = await origin.scmBackend.list({
      ...(d as any),
      tenantId: tenant.id,
      tenant: undefined
    });

    return {
      ...list,
      object: 'list' as const,
      items: list.items.map(normalizeScmProvider)
    };
  }
}

export let scmProviderService = Service.create(
  'scmProvider',
  () => new scmProviderServiceImpl()
).build();
