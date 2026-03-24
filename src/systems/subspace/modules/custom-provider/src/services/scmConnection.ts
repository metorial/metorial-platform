import type { PaginatorInput } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant, TenantActor } from '@metorial-subspace/db';
import { getTenantForOrigin, origin } from '../origin';

class scmConnectionServiceImpl {
  async getScmConnectionById(d: { scmConnectionId: string; tenant: Tenant }) {
    let tenant = await getTenantForOrigin(d.tenant);
    return origin.scmInstallation.get({
      tenantId: tenant.id,
      scmInstallationId: d.scmConnectionId
    });
  }

  async listScmConnections(d: { tenant: Tenant; actor: TenantActor } & PaginatorInput) {
    let tenant = await getTenantForOrigin(d.tenant);
    let actor = await origin.actor.upsert({
      identifier: d.actor.identifier,
      name: d.actor.name
    });

    return origin.scmInstallation.list({
      ...(d as any),
      tenantId: tenant.id,
      actorId: actor.id,
      tenant: undefined,
      actor: undefined
    });
  }
}

export let scmConnectionService = Service.create(
  'scmConnection',
  () => new scmConnectionServiceImpl()
).build();
