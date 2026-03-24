import { Service } from '@lowerdeck/service';
import type { Tenant, TenantActor } from '@metorial-subspace/db';
import { getTenantForOrigin, origin } from '../origin';

class scmConnectionSetupSessionServiceImpl {
  async getScmConnectionSetupSessionById(d: {
    scmConnectionSetupSessionId: string;
    tenant: Tenant;
  }) {
    let tenant = await getTenantForOrigin(d.tenant);
    return origin.scmInstallationSession.get({
      tenantId: tenant.id,
      sessionId: d.scmConnectionSetupSessionId
    });
  }

  async createScmConnectionSetupSession(d: {
    tenant: Tenant;
    actor: TenantActor;
    redirectUrl?: string;
  }) {
    let tenant = await getTenantForOrigin(d.tenant);
    let actor = await origin.actor.upsert({
      identifier: d.actor.identifier,
      name: d.actor.name
    });

    return origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id,
      redirectUrl: d.redirectUrl
    });
  }
}

export let scmConnectionSetupSessionService = Service.create(
  'scmConnectionSetupSession',
  () => new scmConnectionSetupSessionServiceImpl()
).build();
