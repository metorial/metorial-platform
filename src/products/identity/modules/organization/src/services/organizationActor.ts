import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAwaitedAfterTransactionHook,
  db,
  ID,
  Organization,
  OrganizationActor,
  OrganizationActorType,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { metorialResourceService } from '@metorial-subspace/module-tenant';

let include = {
  organization: true,
  member: true,
  machineAccess: true,
  teams: { include: { team: true } }
};

class OrganizationActorService {
  async createOrganizationActor(d: {
    input: {
      type: OrganizationActorType | 'primary_system';
      name: string;
      email?: string;
      image?: PrismaJson.EntityImage;
    };
    organization: Organization;
    auditScope: AuditScope;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.actor.created:before', d);

      let actor = await db.organizationActor.create({
        data: {
          id: await ID.generateId('organizationActor'),
          type: d.input.type === 'primary_system' ? 'system' : d.input.type,
          name: d.input.name,
          email: d.input.email,
          image: d.input.image ?? { type: 'default' },

          // This is for the main system actor, not for actors representing system users
          isSystem: d.input.type === 'primary_system' ? true : null,

          organizationOid: d.organization.oid
        },
        include
      });

      await Fabric.fire('organization.actor.created:after', {
        organization: d.organization,
        actor,
        auditScope: d.auditScope
      });

      await addAwaitedAfterTransactionHook(() =>
        metorialResourceService.syncOrganizationActor(actor)
      );

      return actor;
    });
  }

  async getSystemActor(d: { organization: Organization }) {
    return withTransaction(
      async db => {
        let actor = await db.organizationActor.findFirst({
          where: {
            organizationOid: d.organization.oid,
            isSystem: true
          },
          include
        });
        if (!actor) throw new Error('WTF - System actor not found');

        return actor;
      },
      { ifExists: true }
    );
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
    auditScope: AuditScope;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.actor.updated:before', d);

      let actor = await db.organizationActor.update({
        where: { oid: d.actor.oid },
        data: {
          type: d.input.type,
          name: d.input.name,
          email: d.input.email,
          image: d.input.image
        },
        include
      });

      await Fabric.fire('organization.actor.updated:after', {
        organization: d.organization,
        input: d.input,
        actor,
        previousActor: d.actor,
        auditScope: d.auditScope
      });

      await addAwaitedAfterTransactionHook(() =>
        metorialResourceService.syncOrganizationActor(actor)
      );

      return actor;
    });
  }

  async getOrganizationActorById(d: { organization: Organization; actorId: string }) {
    let actor = await db.organizationActor.findFirst({
      where: {
        id: d.actorId,
        organizationOid: d.organization.oid
      },
      include
    });
    if (!actor) throw new ServiceError(notFoundError('organization_actor', d.actorId));

    return actor;
  }

  async listOrganizationActors(d: { organization: Organization; teamIds?: string[] }) {
    let teams = d.teamIds
      ? await db.team.findMany({
          where: {
            organizationOid: d.organization.oid,
            OR: [{ id: { in: d.teamIds } }, { slug: { in: d.teamIds } }]
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.organizationActor.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,

              type: { not: 'system' },

              OR: [
                { member: null },
                {
                  member: {
                    user: {
                      type: { not: 'system' }
                    }
                  }
                }
              ],

              teams: teams
                ? {
                    some: {
                      id: { in: teams.map(t => t.id) }
                    }
                  }
                : undefined
            },
            include
          })
      )
    );
  }
}

export let organizationActorService = Service.create(
  'organizationActorService',
  () => new OrganizationActorService()
).build();
