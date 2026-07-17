import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import { db } from '@metorial/db';
import type { CargoResourceScope } from './filePurpose';

class ActorServiceImpl {
  async upsertActor(
    d: Pick<CargoResourceScope, 'resourceTenant'> & {
      input: {
        id?: string;
        identifier: string;
        type?: 'external' | 'system';
        name: string;
        organizationActorOid?: bigint;
        consumerOid?: bigint;
      };
    }
  ) {
    let existing = d.input.id
      ? await db.resourceActor.findFirst({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            OR: [{ id: d.input.id }, { identifier: d.input.identifier }]
          }
        })
      : await db.resourceActor.findFirst({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            identifier: d.input.identifier
          }
        });

    if (existing) {
      return await db.resourceActor.update({
        where: {
          id: existing.id
        },
        data: {
          identifier: d.input.identifier,
          type: d.input.type ?? existing.type,
          name: d.input.name,
          organizationActorOid: d.input.organizationActorOid,
          consumerOid: d.input.consumerOid
        }
      });
    }

    let generated = getId('resourceActor');

    return await db.resourceActor.create({
      data: {
        oid: generated.oid,
        id: d.input.id ?? generated.id,
        resourceTenantOid: d.resourceTenant.oid,
        identifier: d.input.identifier,
        type: d.input.type ?? 'external',
        name: d.input.name,
        organizationActorOid: d.input.organizationActorOid,
        consumerOid: d.input.consumerOid
      }
    });
  }

  async getActorById(
    d: Pick<CargoResourceScope, 'resourceTenant'> & {
      actorId: string;
    }
  ) {
    let actor = await db.resourceActor.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        OR: [{ id: d.actorId }, { identifier: d.actorId }]
      }
    });

    if (!actor) throw new ServiceError(notFoundError('resourceActor', d.actorId));

    return actor;
  }
}

export let actorService = Service.create(
  'cargoActorService',
  () => new ActorServiceImpl()
).build();
