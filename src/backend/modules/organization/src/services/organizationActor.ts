import { Context } from '@metorial/context';
import {
  db,
  ID,
  Organization,
  OrganizationActor,
  OrganizationActorType,
  User,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

class OrganizationActorService {
  async createOrganizationActor(d: {
    input: {
      type: OrganizationActorType;
      name: string;
      email?: string;
      image?: PrismaJson.EntityImage;
    };
    organization: Organization;
    context: Context;
    performedBy: { type: 'user'; user: User } | { type: 'actor'; actor: OrganizationActor };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.actor.created:before', d);

      console.log('Creating actor', d.input);

      let actor = await db.organizationActor.create({
        data: {
          id: await ID.generateId('organizationActor'),
          type: d.input.type,
          name: d.input.name,
          email: d.input.email,
          image: d.input.image ?? { type: 'default' },

          // True or null -> to ensure that the field is unique
          isSystem: d.input.type == 'system' ? true : null,

          organizationOid: d.organization.oid
        },
        include: {
          member: true,
          machineAccess: true,
          organization: true
        }
      });

      await Fabric.fire('organization.actor.created:after', {
        ...d,
        actor,
        performedBy: d.performedBy.type == 'user' ? actor : d.performedBy.actor
      });

      return actor;
    });
  }

  async getSystemActor(d: { organization: Organization }) {
    let actor = await db.organizationActor.findFirst({
      where: {
        organizationOid: d.organization.oid,
        isSystem: true
      },
      include: {
        member: true,
        machineAccess: true,
        organization: true
      }
    });
    if (!actor) throw new Error('WTF - System actor not found');

    return actor;
  }

  async updateOrganizationActor(d: {
    actor: OrganizationActor;
    organization: Organization;
    input: {
      type?: OrganizationActorType;
      name?: string;
      email?: string;
      image?: PrismaJson.EntityImage;
    };
    context: Context;
    performedBy: OrganizationActor;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.actor.updated:before', {
        ...d,
        performedBy: d.performedBy
      });

      let actor = await db.organizationActor.update({
        where: { oid: d.actor.oid },
        data: {
          type: d.input.type,
          name: d.input.name,
          email: d.input.email,
          image: d.input.image
        },
        include: {
          member: true,
          machineAccess: true,
          organization: true
        }
      });

      await Fabric.fire('organization.actor.updated:after', {
        ...d,
        actor,
        performedBy: d.performedBy
      });

      return actor;
    });
  }

  async getOrganizationActorById(d: { organization: Organization; actorId: string }) {
    let actor = await db.organizationActor.findFirst({
      where: {
        id: d.actorId,
        organizationOid: d.organization.oid
      },
      include: {
        member: true,
        machineAccess: true,
        organization: true
      }
    });
    if (!actor) throw new ServiceError(notFoundError('organization_actor', d.actorId));

    return actor;
  }

  async listOrganizationActors(d: { organization: Organization; context: Context }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.organizationActor.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid
            },
            include: {
              member: true,
              machineAccess: true,
              organization: true
            }
          })
      )
    );
  }
}

export let organizationActorService = Service.create(
  'organizationActorService',
  () => new OrganizationActorService()
).build();
