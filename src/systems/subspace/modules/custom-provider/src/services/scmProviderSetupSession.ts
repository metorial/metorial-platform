import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import { getTenantForOrigin, origin } from '../origin';

class scmProviderSetupSessionServiceImpl {
  async getScmProviderSetupSessionById(d: {
    scmProviderSetupSessionId: string;
    tenant: Tenant;
  }) {
    let tenant = await getTenantForOrigin(d.tenant);
    return origin.scmBackendSetupSession.get({
      tenantId: tenant.id,
      sessionId: d.scmProviderSetupSessionId
    });
  }

  async createScmProviderSetupSession(d: {
    tenant: Tenant;
    type: 'github_enterprise' | 'gitlab_selfhosted';
  }) {
    let tenant = await getTenantForOrigin(d.tenant);
    return origin.scmBackendSetupSession.create({
      tenantId: tenant.id,
      type: d.type
    });
  }
}

export let scmProviderSetupSessionService = Service.create(
  'scmProviderSetupSession',
  () => new scmProviderSetupSessionServiceImpl()
).build();
