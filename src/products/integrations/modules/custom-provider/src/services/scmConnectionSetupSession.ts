import { Service } from '@lowerdeck/service';
import type { Tenant, TenantActor } from '@metorial-subspace/db';
import {
  type MetorialFacing,
  type MetorialFacingWithActor,
  resolveMetorialFacing,
  resolveMetorialFacingWithActor
} from '@metorial-subspace/module-tenant';
import {
  getTenantForOrigin,
  normalizeScmConnectionSetupSession,
  origin,
  type ScmConnectionSetupSession
} from '../origin';

type GetScmConnectionSetupSessionByIdParams = {
  scmConnectionSetupSessionId: string;
};

type CreateScmConnectionSetupSessionParams = {
  redirectUrl?: string;
};

class scmConnectionSetupSessionServiceImpl {
  async getScmConnectionSetupSessionById(
    d: MetorialFacing<GetScmConnectionSetupSessionByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getScmConnectionSetupSessionByIdInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getScmConnectionSetupSessionByIdInternal(
    d: { tenant: Tenant } & GetScmConnectionSetupSessionByIdParams
  ): Promise<ScmConnectionSetupSession> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmConnectionSetupSession(
      await origin.scmInstallationSession.get({
        tenantId: tenant.id,
        sessionId: d.scmConnectionSetupSessionId
      })
    );
  }

  async createScmConnectionSetupSession(
    d: MetorialFacingWithActor<CreateScmConnectionSetupSessionParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithActor(d);

    return this.createScmConnectionSetupSessionInternal({
      ...rest,
      tenant: scope.tenant,
      actor: scope.actor
    });
  }

  async createScmConnectionSetupSessionInternal(d: {
    tenant: Tenant;
    actor: TenantActor;
    redirectUrl?: string;
  }): Promise<ScmConnectionSetupSession> {
    let tenant = await getTenantForOrigin(d.tenant);
    let actor = await origin.actor.upsert({
      identifier: d.actor.identifier,
      name: d.actor.name
    });

    return normalizeScmConnectionSetupSession(
      await origin.scmInstallationSession.create({
        tenantId: tenant.id,
        actorId: actor.id,
        redirectUrl: d.redirectUrl
      })
    );
  }
}

export let scmConnectionSetupSessionService = Service.create(
  'scmConnectionSetupSession',
  () => new scmConnectionSetupSessionServiceImpl()
).build();
