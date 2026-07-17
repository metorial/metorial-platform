import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, ID } from '@metorial/db';
import type { ResourceScope } from './resourceScope';

class ResourceActorServiceImpl {
  async upsertActor(
    d: Pick<ResourceScope, 'resourceTenant'> & {
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

    return await db.resourceActor.create({
      data: {
        id: d.input.id ?? (await ID.generateId('resourceActor')),
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
    d: Pick<ResourceScope, 'resourceTenant'> & {
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

  async ensureOrganizationActor(
    d: Pick<ResourceScope, 'resourceTenant'> & {
      organizationActorOid: bigint;
    }
  ) {
    let organizationActor = await db.organizationActor.findUnique({
      where: {
        oid: d.organizationActorOid
      },
      select: {
        oid: true,
        id: true,
        name: true
      }
    });
    if (!organizationActor) {
      throw new ServiceError(
        notFoundError('organizationActor', d.organizationActorOid.toString())
      );
    }

    return await this.upsertActor({
      resourceTenant: d.resourceTenant,
      input: {
        identifier: `mte-oac-${organizationActor.id}`,
        name: organizationActor.name,
        organizationActorOid: organizationActor.oid
      }
    });
  }

  async ensureConsumerActor(
    d: Pick<ResourceScope, 'resourceTenant'> & {
      consumerOid: bigint;
    }
  ) {
    let consumer = await db.consumer.findUnique({
      where: {
        oid: d.consumerOid
      },
      select: {
        oid: true,
        id: true,
        name: true
      }
    });
    if (!consumer) {
      throw new ServiceError(notFoundError('consumer', d.consumerOid.toString()));
    }

    return await this.upsertActor({
      resourceTenant: d.resourceTenant,
      input: {
        identifier: `mte-con-${consumer.id}`,
        name: consumer.name,
        consumerOid: consumer.oid
      }
    });
  }
}

export let resourceActorService = Service.create(
  'resourceActorService',
  () => new ResourceActorServiceImpl()
).build();
