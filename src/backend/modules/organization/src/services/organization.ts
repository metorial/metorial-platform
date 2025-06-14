import { Context } from '@metorial/context';
import { db, ID, Organization, OrganizationActor, User, withTransaction } from '@metorial/db';
import {
  forbiddenError,
  notFoundError,
  notImplementedError,
  ServiceError
} from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { createSlugGenerator } from '@metorial/slugify';
import { differenceInMinutes } from 'date-fns';
import { organizationActorService } from './organizationActor';
import { organizationMemberService } from './organizationMember';

let getOrgSlug = createSlugGenerator(
  async slug => !(await db.organization.findFirst({ where: { slug } }))
);

class OrganizationService {
  private async ensureOrganizationActive(organization: Organization) {
    if (organization.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted organization'
        })
      );
    }
  }

  async createOrganization(d: {
    input: {
      name: string;
      image?: PrismaJson.EntityImage;
    };
    context: Context;
    performedBy: User;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.created:before', d);

      let organization = await db.organization.create({
        data: {
          id: await ID.generateId('organization'),
          status: 'active',
          type: 'default',
          slug: await getOrgSlug({ input: d.input.name }),
          name: d.input.name,
          image: d.input.image ?? { type: 'default' }
        }
      });

      await Fabric.fire('organization.created:after', {
        ...d,
        organization,
        performedBy: d.performedBy
      });

      let systemActor = await organizationActorService.createOrganizationActor({
        input: {
          type: 'system',
          name: 'Metorial',
          image: {
            type: 'url',
            url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
          }
        },
        organization,
        context: d.context,
        performedBy: { type: 'user', user: d.performedBy }
      });

      let member = await organizationMemberService.createOrganizationMember({
        user: d.performedBy,
        organization,
        input: { role: 'admin' },
        context: d.context,
        performedBy: { type: 'actor', actor: systemActor }
      });

      return {
        organization,
        member,
        actor: member.actor
      };
    });
  }

  async updateOrganization(d: {
    input: {
      name?: string;
      image?: PrismaJson.EntityImage;
    };
    organization: Organization;
    context: Context;
    performedBy: OrganizationActor;
  }) {
    await this.ensureOrganizationActive(d.organization);

    return withTransaction(async db => {
      await Fabric.fire('organization.updated:before', d);

      let organization = await db.organization.update({
        where: { id: d.organization.id },
        data: {
          name: d.input.name,
          image: d.input.image
        }
      });

      await Fabric.fire('organization.updated:after', {
        ...d,
        organization,
        performedBy: d.performedBy
      });

      return organization;
    });
  }

  async deleteOrganization(d: {
    organization: Organization;
    context: Context;
    performedBy: OrganizationActor;
  }) {
    await this.ensureOrganizationActive(d.organization);

    throw new ServiceError(
      notImplementedError({
        message: 'Deleting organizations is not supported yet'
      })
    );

    return d.organization;
  }

  async getOrganizationByIdForUser(d: { organizationId: string; user: { id: string } }) {
    let org = await db.organization.findFirst({
      where: {
        OR: [{ id: d.organizationId }, { slug: d.organizationId }],
        members: {
          some: {
            user: { id: d.user.id },
            status: 'active'
          }
        }
      },
      include: {
        members: {
          where: {
            user: { id: d.user.id },
            status: 'active'
          },
          include: {
            actor: true,
            user: true
          }
        }
      }
    });
    let member = org?.members[0];
    if (!org || !member) {
      throw new ServiceError(notFoundError('organization', d.organizationId));
    }

    if (!member.lastActiveAt || differenceInMinutes(new Date(), member.lastActiveAt) > 30) {
      await db.organizationMember.update({
        where: { id: member.id },
        data: { lastActiveAt: new Date() }
      });
    }

    return {
      organization: org,
      member,
      actor: member.actor
    };
  }

  async listOrganizations(d: {
    filter: { type: 'actor'; actor: OrganizationActor } | { type: 'user'; user: User };
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.organization.findMany({
            ...opts,
            where: {
              status: 'active',

              actors:
                d.filter.type === 'actor'
                  ? {
                      some: {
                        oid: d.filter.actor.oid
                      }
                    }
                  : undefined,

              members:
                d.filter.type === 'user'
                  ? {
                      some: {
                        userOid: d.filter.user.oid,
                        status: 'active'
                      }
                    }
                  : undefined
            }
          })
      )
    );
  }

  async bootUser(d: { user: User }) {
    let orgs = await db.organization.findMany({
      where: {
        members: {
          some: {
            userOid: d.user.oid,
            status: 'active'
          }
        }
      },
      orderBy: { id: 'asc' },
      include: {
        members: {
          where: {
            userOid: d.user.oid,
            status: 'active'
          },
          include: {
            actor: true
          }
        },
        projects: {
          orderBy: { id: 'asc' }
        },
        instances: {
          include: {
            project: true
          },
          orderBy: { id: 'asc' }
        }
      }
    });

    return {
      user: d.user,
      organizations: orgs.map(org => ({
        ...org,
        member: org.members[0]
      })),
      projects: orgs.flatMap(org =>
        org.projects.map(project => ({ ...project, organization: org }))
      ),
      instances: orgs.flatMap(org =>
        org.instances.map(instance => ({
          ...instance,
          organization: org,
          project: instance.project
        }))
      )
    };
  }
}

export let organizationService = Service.create(
  'organizationService',
  () => new OrganizationService()
).build();
