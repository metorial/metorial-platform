import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  InstanceType,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Project,
  User,
  withTransaction
} from '@metorial/db';
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
import { projectService } from './project';

let getInstanceSlug = createSlugGenerator(
  async slug => !(await db.instance.findFirst({ where: { slug } }))
);

class InstanceService {
  private async ensureInstanceActive(instance: Instance) {
    if (instance.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted instance'
        })
      );
    }
  }

  async createInstance(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name: string;
      type: InstanceType;
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.project.instance.created:before', d);

      let instance = await db.instance.create({
        data: {
          id: await ID.generateId('instance'),
          status: 'active',
          slug: await getInstanceSlug({ input: d.input.name }),
          name: d.input.name,
          type: d.input.type,
          organizationOid: d.organization.oid,
          projectOid: d.project.oid
        },
        include: {
          organization: true,
          project: true
        }
      });

      await Fabric.fire('organization.project.instance.created:after', {
        ...d,
        instance,
        performedBy: d.performedBy
      });

      return instance;
    });
  }

  async updateInstance(d: {
    instance: Instance & { project: Project };
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name?: string;
    };
  }) {
    await this.ensureInstanceActive(d.instance);

    return withTransaction(async db => {
      await Fabric.fire('organization.project.instance.updated:before', {
        ...d,
        project: d.instance.project
      });

      let instance = await db.instance.update({
        where: { oid: d.instance.oid },
        data: {
          name: d.input.name
        },
        include: {
          organization: true,
          project: true
        }
      });

      await Fabric.fire('organization.project.instance.updated:after', {
        ...d,
        instance,
        performedBy: d.performedBy,
        project: d.instance.project
      });

      return instance;
    });
  }

  async deleteInstance(d: {
    instance: Instance & { project: Project };
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.ensureInstanceActive(d.instance);

    throw new ServiceError(
      notImplementedError({
        message: 'Instance deletion is not supported yet'
      })
    );

    return {
      ...d.instance,
      organization: d.organization
    };
  }

  getInstanceTeamAccessWhere(d: {
    organization: Organization;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    let project = projectService.getProjectTeamAccessWhere({
      organization: d.organization,
      actor: d.actor,
      member: d.member
    });

    if (!project) return undefined;

    return {
      teams: project
    };
  }

  async getInstanceById(d: {
    organization: Organization;
    instanceId: string;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    let instance = await db.instance.findFirst({
      where: {
        OR: [{ id: d.instanceId }, { slug: d.instanceId }],
        organizationOid: d.organization.oid,

        project: this.getInstanceTeamAccessWhere({
          organization: d.organization,
          actor: d.actor,
          member: d.member
        })
      },
      include: {
        organization: true,
        project: true
      }
    });
    if (!instance) throw new ServiceError(notFoundError('instance', d.instanceId));

    return instance;
  }

  async listInstances(d: {
    organization: Organization;
    project?: Project;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.instance.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              projectOid: d.project?.oid,
              status: 'active',

              project: this.getInstanceTeamAccessWhere({
                organization: d.organization,
                actor: d.actor,
                member: d.member
              })
            },
            include: {
              organization: true,
              project: true
            }
          })
      )
    );
  }

  async getManyInstancesForOrganization(d: {
    organization: Organization;
    instanceIds?: string[];
  }) {
    return await db.instance.findMany({
      where: {
        id: { in: d.instanceIds },
        organizationOid: d.organization.oid
      },
      include: {
        organization: true,
        project: true
      }
    });
  }

  async getInstanceByIdForUser(d: { instanceId: string; user: User }) {
    let instance = await db.instance.findFirst({
      where: {
        OR: [{ id: d.instanceId }, { slug: d.instanceId }],
        organization: {
          members: {
            some: {
              userOid: d.user.oid,
              status: 'active'
            }
          }
        }
      },
      include: {
        organization: {
          include: {
            members: {
              where: {
                userOid: d.user.oid,
                status: 'active'
              },
              include: {
                actor: true
              }
            }
          }
        },
        project: true
      }
    });
    let member = instance?.organization.members[0];
    if (!instance || !member) {
      throw new ServiceError(notFoundError('instance', d.instanceId));
    }

    if (!member.lastActiveAt || differenceInMinutes(new Date(), member.lastActiveAt) > 30) {
      await db.organizationMember.update({
        where: { id: member.id },
        data: { lastActiveAt: new Date() }
      });
    }

    return {
      instance,
      member,
      actor: member.actor,
      project: instance.project,
      organization: instance.organization
    };
  }
}

export let instanceService = Service.create(
  'instanceService',
  () => new InstanceService()
).build();
