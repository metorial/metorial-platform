import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, getId, type Tenant, type TenantActorType } from '@metorial-subspace/db';
import { ensureOrganizationActorMirror } from '../lib/mirrorRecords';

let include = {};

class actorServiceImpl {
  async findActorForOrganizationActor(d: {
    tenant: Tenant;
    organizationActor: { oid: bigint; id: string; subspaceActorId?: string | null };
    identifier: string;
  }) {
    return await db.tenantActor.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [
          { identifier: d.identifier },
          { organizationActorOid: d.organizationActor.oid },
          { organizationActorId: d.organizationActor.id },
          ...(d.organizationActor.subspaceActorId
            ? [{ id: d.organizationActor.subspaceActorId }]
            : [])
        ]
      },
      include
    });
  }

  async upsertActor(d: {
    tenant: Tenant;
    input: {
      id?: string;
      name: string;
      identifier: string;
      type: TenantActorType;
      organizationActorId?: string;
      organizationActorOid?: bigint;
      resourceActorId?: string;
      resourceActorIdentifier?: string;
    };
  }) {
    let organizationActorOid =
      d.input.organizationActorOid === undefined
        ? undefined
        : ((await ensureOrganizationActorMirror({
            organizationActorOid: d.input.organizationActorOid
          })) ?? undefined);

    let update = {
      name: d.input.name,
      identifier: d.input.identifier,
      type: d.input.type,
      organizationActorId: d.input.organizationActorId,
      organizationActorOid,
      resourceActorId: d.input.resourceActorId,
      resourceActorIdentifier: d.input.resourceActorIdentifier,
      ...(d.tenant.projectOid != null ? { projectOid: d.tenant.projectOid } : {})
    };

    try {
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
        update,
        create: {
          ...getId('tenantActor'),
          ...(d.input.id ? { id: d.input.id } : {}),
          name: d.input.name,
          identifier: d.input.identifier,
          type: d.input.type,
          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          organizationActorId: d.input.organizationActorId,
          organizationActorOid,
          resourceActorId: d.input.resourceActorId,
          resourceActorIdentifier: d.input.resourceActorIdentifier
        },
        include
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;

      let actor = await db.tenantActor.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          OR: [
            ...(d.input.id ? [{ id: d.input.id }] : []),
            { identifier: d.input.identifier },
            ...(organizationActorOid != null ? [{ organizationActorOid }] : [])
          ]
        },
        include
      });
      if (!actor) throw error;

      try {
        return await db.tenantActor.update({
          where: { id: actor.id },
          data: update,
          include
        });
      } catch (updateError: any) {
        if (updateError?.code !== 'P2002') throw updateError;
        return actor;
      }
    }
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
