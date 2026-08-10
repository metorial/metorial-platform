import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import {
  getTenantForOrigin,
  normalizeScmProviderSetupSession,
  origin,
  type ScmProviderSetupSession
} from '../origin';

class scmProviderSetupSessionServiceImpl {
  async getScmProviderSetupSessionById(d: {
    scmProviderSetupSessionId: string;
    tenant: Tenant;
  }): Promise<ScmProviderSetupSession> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmProviderSetupSession(await origin.scmBackendSetupSession.get({
      tenantId: tenant.id,
      sessionId: d.scmProviderSetupSessionId
    }));
  }

  async createScmProviderSetupSession(d: {
    tenant: Tenant;
    type: 'github_enterprise' | 'gitlab_selfhosted' | 'bitbucket_data_center';
  }): Promise<ScmProviderSetupSession> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmProviderSetupSession(await origin.scmBackendSetupSession.create({
      tenantId: tenant.id,
      type: d.type
    }));
  }
}

export let scmProviderSetupSessionService = Service.create(
  'scmProviderSetupSession',
  () => new scmProviderSetupSessionServiceImpl()
).build();
