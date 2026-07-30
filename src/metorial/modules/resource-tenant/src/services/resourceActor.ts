import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, ID, type Prisma } from '@metorial/db';
import type { ResourceScope } from './resourceScope';

export let resourceActorPresentationInclude = {
  organizationActor: {
    include: {
      organization: true,
      member: true,
      teams: {
        include: {
          team: true
        }
      }
    }
  },
  consumerProfile: {
    include: {
      consumer: {
        include: {
          instanceConsumers: {
            include: {
              consumer: true
            }
          }
        }
      },
      organizationMember: true,
      surface: true
    }
  },
  consumer: {
    include: {
      instanceConsumers: {
        include: {
          consumer: true
        }
      },
      organizationMember: true
    }
  }
} satisfies Prisma.ResourceActorInclude;

export type ResourceActorPresentationRecord = Prisma.ResourceActorGetPayload<{
  include: typeof resourceActorPresentationInclude;
}>;

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
        consumerProfileOid?: bigint;
      };
    }
  ) {
    if (d.input.consumerOid && !d.input.consumerProfileOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Consumer resource actors must be linked to a consumer profile.'
        })
      );
    }

    if (!d.input.id) {
      try {
        return await db.resourceActor.upsert({
          where: {
            resourceTenantOid_identifier: {
              resourceTenantOid: d.resourceTenant.oid,
              identifier: d.input.identifier
            }
          },
          update: {
            type: d.input.type,
            name: d.input.name,
            organizationActorOid: d.input.organizationActorOid,
            consumerOid: d.input.consumerOid,
            consumerProfileOid: d.input.consumerProfileOid
          },
          create: {
            id: await ID.generateId('resourceActor'),
            resourceTenantOid: d.resourceTenant.oid,
            identifier: d.input.identifier,
            type: d.input.type ?? 'external',
            name: d.input.name,
            organizationActorOid: d.input.organizationActorOid,
            consumerOid: d.input.consumerOid,
            consumerProfileOid: d.input.consumerProfileOid
          }
        });
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error;

        let resourceActor = await db.resourceActor.findFirst({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            identifier: d.input.identifier
          }
        });
        if (!resourceActor) throw error;

        return resourceActor;
      }
    }

    let existing = d.input.id
      ? await db.resourceActor.findFirst({
          where: {
            resourceTenantOid: d.resourceTenant.oid,
            OR: [{ id: d.input.id }, { identifier: d.input.identifier }]
          }
        })
      : undefined;

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
          consumerOid: d.input.consumerOid,
          consumerProfileOid: d.input.consumerProfileOid
        }
      });
    }

    try {
      return await db.resourceActor.create({
        data: {
          id: d.input.id ?? (await ID.generateId('resourceActor')),
          resourceTenantOid: d.resourceTenant.oid,
          identifier: d.input.identifier,
          type: d.input.type ?? 'external',
          name: d.input.name,
          organizationActorOid: d.input.organizationActorOid,
          consumerOid: d.input.consumerOid,
          consumerProfileOid: d.input.consumerProfileOid
        }
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;

      let resourceActor = await db.resourceActor.findFirst({
        where: {
          resourceTenantOid: d.resourceTenant.oid,
          OR: [{ id: d.input.id }, { identifier: d.input.identifier }]
        }
      });
      if (!resourceActor) throw error;

      return resourceActor;
    }
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

  async ensureConsumerProfileActor(
    d: Pick<ResourceScope, 'resourceTenant'> & {
      consumerProfileOid?: bigint;
      consumerProfile?: {
        oid: bigint;
      };
    }
  ) {
    let consumerProfileOid = d.consumerProfileOid ?? d.consumerProfile?.oid;
    if (!consumerProfileOid) {
      throw new ServiceError(notFoundError('consumerProfile'));
    }

    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        oid: consumerProfileOid,
        instance: {
          resourceTenantOid: d.resourceTenant.oid
        }
      },
      select: {
        oid: true,
        id: true,
        name: true,
        consumerOid: true
      }
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumerProfile', consumerProfileOid.toString()));
    }

    return await this.upsertActor({
      resourceTenant: d.resourceTenant,
      input: {
        identifier: `mte-cpf-${consumerProfile.id}`,
        name: consumerProfile.name,
        consumerOid: consumerProfile.consumerOid,
        consumerProfileOid: consumerProfile.oid
      }
    });
  }
}

export let resourceActorService = Service.create(
  'resourceActorService',
  () => new ResourceActorServiceImpl()
).build();
