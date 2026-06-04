import {
  conflictError,
  forbiddenError,
  notFoundError,
  notImplementedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Project,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCode } from '@metorial/id';
import { syncBrandQueue } from '../queues/syncBrand';
import { syncSubspaceTenantQueue } from '../queues/syncSubspaceTenant';
import { instanceService } from './instance';

let getProjectSlug = createSlugGenerator(
  async slug => !(await db.project.findFirst({ where: { slug } }))
);

class ProjectService {
  private async ensureProjectActive(project: Project) {
    if (project.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted project'
        })
      );
    }
  }

  async createProject(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name: string;
      magicMcpSessionDurationMinutes?: number;
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.project.created:before', d);

      let project = await db.project.create({
        data: {
          id: await ID.generateId('project'),
          status: 'active',
          slug: await getProjectSlug({ input: `${d.input.name}-${generateCode(5)}` }),
          name: d.input.name,
          magicMcpSessionDurationMinutes: d.input.magicMcpSessionDurationMinutes,
          organizationOid: d.organization.oid
        },
        include: {
          organization: true
        }
      });

      await instanceService.createInstance({
        project,
        organization: d.organization,
        performedBy: d.performedBy,
        context: d.context,
        input: {
          name: `Production`,
          type: 'production'
        }
      });

      await addAfterTransactionHook(() => syncBrandQueue.add({ projectId: project.id }));
      await addAfterTransactionHook(() =>
        syncSubspaceTenantQueue.add({ projectId: project.id })
      );

      await Fabric.fire('organization.project.created:after', {
        ...d,
        project,
        performedBy: d.performedBy
      });

      return project;
    });
  }

  async updateProject(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name?: string;
      slug?: string;
      onlyAllowTrustedProviders?: boolean;
      magicMcpSessionDurationMinutes?: number;
    };
  }) {
    await this.ensureProjectActive(d.project);

    return withTransaction(async db => {
      await Fabric.fire('organization.project.updated:before', d);

      if (d.input.slug && d.input.slug !== d.project.slug) {
        let existingProject = await db.project.findFirst({
          where: {
            slug: d.input.slug,
            id: { not: d.project.id }
          }
        });

        if (existingProject) {
          throw new ServiceError(
            conflictError({
              message: 'A project with this slug already exists'
            })
          );
        }
      }

      let project = await db.project.update({
        where: { oid: d.project.oid },
        data: {
          name: d.input.name,
          slug: d.input.slug,
          onlyAllowTrustedProviders: d.input.onlyAllowTrustedProviders,
          magicMcpSessionDurationMinutes: d.input.magicMcpSessionDurationMinutes
        },
        include: {
          organization: true
        }
      });

      await addAfterTransactionHook(() => syncBrandQueue.add({ projectId: project.id }));
      await addAfterTransactionHook(() =>
        syncSubspaceTenantQueue.add({ projectId: project.id })
      );

      await Fabric.fire('organization.project.updated:after', {
        ...d,
        project,
        performedBy: d.performedBy
      });

      return project;
    });
  }

  async deleteProject(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.ensureProjectActive(d.project);

    throw new ServiceError(
      notImplementedError({
        message: 'Project deletion is not supported yet'
      })
    );

    return {
      ...d.project,
      organization: d.organization
    };
  }

  async getProjectById(d: {
    organization: Organization;
    projectId: string;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    let project = await db.project.findFirst({
      where: {
        OR: [{ id: d.projectId }, { slug: d.projectId }],
        organizationOid: d.organization.oid
      },
      include: {
        organization: true
      }
    });
    if (!project) throw new ServiceError(notFoundError('project', d.projectId));

    return project;
  }

  async listProjects(d: {
    organization: Organization;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
    projectIds?: string[];
    teamIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.project.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active',
              id: d.projectIds ? { in: d.projectIds } : undefined
            },
            include: {
              organization: true
            }
          })
      )
    );
  }

  async getAllProjects(d: {
    organization: Organization;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    return await db.project.findMany({
      where: {
        organizationOid: d.organization.oid,
        status: 'active'
      },
      include: {
        organization: true,
        instances: true
      }
    });
  }

  async getManyProjectsByIds(d: { organization: Organization; projectIds: string[] }) {
    let projects = await db.project.findMany({
      where: {
        organizationOid: d.organization.oid,
        OR: [{ id: { in: d.projectIds } }, { slug: { in: d.projectIds } }]
      },
      include: {
        organization: true
      }
    });

    return projects;
  }
}

export let projectService = Service.create(
  'projectService',
  () => new ProjectService()
).build();
