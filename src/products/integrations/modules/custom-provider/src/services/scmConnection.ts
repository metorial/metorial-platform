import type { PaginatorInput } from '@lowerdeck/pagination';
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
  normalizeScmConnection,
  origin,
  type OriginList,
  type ScmConnection
} from '../origin';

type GetScmConnectionByIdParams = {
  scmConnectionId: string;
};

type ListScmConnectionsParams = PaginatorInput;

class scmConnectionServiceImpl {
  async getScmConnectionById(d: MetorialFacing<GetScmConnectionByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getScmConnectionByIdInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getScmConnectionByIdInternal(
    d: { tenant: Tenant } & GetScmConnectionByIdParams
  ): Promise<ScmConnection> {
    let tenant = await getTenantForOrigin(d.tenant);
    return normalizeScmConnection(
      await origin.scmInstallation.get({
        tenantId: tenant.id,
        scmInstallationId: d.scmConnectionId
      })
    );
  }

  async listScmConnections(d: MetorialFacingWithActor<ListScmConnectionsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithActor(d);

    return this.listScmConnectionsInternal({
      ...rest,
      tenant: scope.tenant,
      actor: scope.actor
    });
  }

  async listScmConnectionsInternal(
    d: { tenant: Tenant; actor: TenantActor } & PaginatorInput
  ): Promise<OriginList<ScmConnection>> {
    let tenant = await getTenantForOrigin(d.tenant);
    let actor = await origin.actor.upsert({
      identifier: d.actor.identifier,
      name: d.actor.name
    });

    let list = await origin.scmInstallation.list({
      ...(d as any),
      tenantId: tenant.id,
      actorId: actor.id,
      tenant: undefined,
      actor: undefined
    });

    return {
      ...list,
      object: 'list' as const,
      items: list.items.map(normalizeScmConnection)
    };
  }
}

export let scmConnectionService = Service.create(
  'scmConnection',
  () => new scmConnectionServiceImpl()
).build();
