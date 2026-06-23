import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import {
  getTenantForOrigin,
  normalizeScmProvider,
  origin,
  type OriginList,
  type ScmProvider
} from '../origin';

class scmProviderServiceImpl {
  async getScmProviderById(d: {
    scmProviderId: string;
    tenant: Tenant;
  }): Promise<ScmProvider> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmProvider(await origin.scmBackend.get({
      tenantId: tenant.id,
      backendId: d.scmProviderId
    }));
  }

  async listScmProviders(
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
