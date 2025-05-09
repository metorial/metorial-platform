import { Context } from '@metorial/context';
import {
  db,
  ID,
  Organization,
  OrganizationActor,
  Project,
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
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.project.created:before', d);

      let project = await db.project.create({
        data: {
          id: await ID.generateId('project'),
          status: 'active',
          slug: await getProjectSlug({ input: d.input.name }),
          name: d.input.name,
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
          name: `Development`,
          type: 'development'
        }
      });

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
    };
  }) {
    await this.ensureProjectActive(d.project);

    return withTransaction(async db => {
      await Fabric.fire('organization.project.updated:before', d);

      let project = await db.project.update({
        where: { oid: d.project.oid },
        data: {
          name: d.input.name
        },
        include: {
          organization: true
        }
      });

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

  async getProjectById(d: { organization: Organization; projectId: string }) {
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

  async listProjects(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.project.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active'
            },
            include: {
              organization: true
            }
          })
      )
    );
  }
}

export let projectService = Service.create(
  'projectService',
  () => new ProjectService()
).build();
