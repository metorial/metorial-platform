import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, getId, type Tenant, type TenantActorType } from '@metorial-subspace/db';

let include = {};

class actorServiceImpl {
  async upsertActor(d: {
    tenant: Tenant;
    input: {
      id?: string;
      name: string;
      identifier: string;
      type: TenantActorType;
      organizationActorId?: string;
      consumerId?: string;
      resourceActorId?: string;
      resourceActorIdentifier?: string;
    };
  }) {
    return await db.tenantActor.upsert({
      where: d.input.id
        ? {
            id: d.input.id
          }
        : {
            tenantOid_identifier: {
              identifier: d.input.identifier,
              tenantOid: d.tenant.oid
            }
          },
      update: {
        name: d.input.name,
        identifier: d.input.identifier,
        type: d.input.type,
        organizationActorId: d.input.organizationActorId,
        consumerId: d.input.consumerId,
        resourceActorId: d.input.resourceActorId,
        resourceActorIdentifier: d.input.resourceActorIdentifier
      },
      create: {
        ...getId('tenantActor'),
        name: d.input.name,
        identifier: d.input.identifier,
        type: d.input.type,
        tenantOid: d.tenant.oid,
        organizationActorId: d.input.organizationActorId,
        consumerId: d.input.consumerId,
        resourceActorId: d.input.resourceActorId,
        resourceActorIdentifier: d.input.resourceActorIdentifier
      },
      include
    });
  }

  async getActorById(d: { tenant: Tenant; id: string }) {
    let actor = await db.tenantActor.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [{ id: d.id }, { identifier: d.id }]
      },
      include
    });
    if (!actor) throw new ServiceError(notFoundError('actor'));
    return actor;
  }

  async getSystemActor(d: { tenant: Tenant }) {
    return this.upsertActor({
      tenant: d.tenant,
      input: {
        name: 'System',
        identifier: `system::${d.tenant.identifier}`,
        type: 'system'
      }
    });
  }
}

export let actorService = Service.create('actorService', () => new actorServiceImpl()).build();
