import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import { getTenantForOrigin, origin } from '../origin';

class scmProviderServiceImpl {
  async getScmProviderById(d: { scmProviderId: string; tenant: Tenant }) {
    let tenant = await getTenantForOrigin(d.tenant);
    return origin.scmBackend.get({
      tenantId: tenant.id,
      backendId: d.scmProviderId
    });
  }

  async listScmProviders(d: { tenant: Tenant } & PaginatorInput) {
    let tenant = await getTenantForOrigin(d.tenant);
    return origin.scmBackend.list({
      ...(d as any),
      tenantId: tenant.id,
      tenant: undefined
    });
  }
}

export let scmProviderService = Service.create(
  'scmProvider',
  () => new scmProviderServiceImpl()
).build();
