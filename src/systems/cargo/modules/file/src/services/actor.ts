import { notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { db, getId } from '@metorial-cargo/db';
import type { CargoTenantEnvironment } from './filePurpose';

class ActorServiceImpl {
  async upsertActor(
    d: Pick<CargoTenantEnvironment, 'tenant'> & {
      input: {
        id?: string;
        identifier: string;
        type?: 'external' | 'system';
        name: string;
        organizationActorId?: string;
        consumerId?: string;
      };
    }
  ) {
    let existing = d.input.id
      ? await db.tenantActor.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            OR: [{ id: d.input.id }, { identifier: d.input.identifier }]
          }
        })
      : await db.tenantActor.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            identifier: d.input.identifier
          }
        });

    if (existing) {
      return await db.tenantActor.update({
        where: {
          id: existing.id
        },
        data: {
          identifier: d.input.identifier,
          type: d.input.type ?? existing.type,
          name: d.input.name,
          organizationActorId: d.input.organizationActorId,
          consumerId: d.input.consumerId
        }
      });
    }

    let generated = getId('tenantActor');

    return await db.tenantActor.create({
      data: {
        oid: generated.oid,
        id: d.input.id ?? generated.id,
        tenantOid: d.tenant.oid,
        identifier: d.input.identifier,
        type: d.input.type ?? 'external',
        name: d.input.name,
        organizationActorId: d.input.organizationActorId,
        consumerId: d.input.consumerId
      }
    });
  }

  async getActorById(
    d: Pick<CargoTenantEnvironment, 'tenant'> & {
      actorId: string;
    }
  ) {
    let actor = await db.tenantActor.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [{ id: d.actorId }, { identifier: d.actorId }]
      }
    });

    if (!actor) throw new ServiceError(notFoundError('tenantActor', d.actorId));

    return actor;
  }
}

export let actorService = Service.create(
  'cargoActorService',
  () => new ActorServiceImpl()
).build();
