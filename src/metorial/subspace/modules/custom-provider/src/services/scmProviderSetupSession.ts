import { Service } from '@lowerdeck/service';
import type { Tenant } from '@metorial-subspace/db';
import {
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  getTenantForOrigin,
  normalizeScmProviderSetupSession,
  origin,
  type ScmProviderSetupSession
} from '../origin';

type GetScmProviderSetupSessionByIdParams = {
  scmProviderSetupSessionId: string;
};

type CreateScmProviderSetupSessionParams = {
  type: 'github_enterprise' | 'gitlab_selfhosted' | 'bitbucket_data_center';
};

class scmProviderSetupSessionServiceImpl {
  async getScmProviderSetupSessionById(
    d: MetorialFacing<GetScmProviderSetupSessionByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getScmProviderSetupSessionByIdInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getScmProviderSetupSessionByIdInternal(
    d: { tenant: Tenant } & GetScmProviderSetupSessionByIdParams
  ): Promise<ScmProviderSetupSession> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmProviderSetupSession(
      await origin.scmBackendSetupSession.get({
        tenantId: tenant.id,
        sessionId: d.scmProviderSetupSessionId
      })
    );
  }

  async createScmProviderSetupSession(
    d: MetorialFacing<CreateScmProviderSetupSessionParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.createScmProviderSetupSessionInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async createScmProviderSetupSessionInternal(
    d: { tenant: Tenant } & CreateScmProviderSetupSessionParams
  ): Promise<ScmProviderSetupSession> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmProviderSetupSession(
      await origin.scmBackendSetupSession.create({
        tenantId: tenant.id,
        type: d.type
      })
    );
  }
}

export let scmProviderSetupSessionService = Service.create(
  'scmProviderSetupSession',
  () => new scmProviderSetupSessionServiceImpl()
).build();
